const MAX_TARGETED_QUESTIONS = 4;

function asText(value) {
  return String(value || '').trim();
}

function compact(value) {
  return asText(value).toLowerCase();
}

function slug(value) {
  return compact(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'tool';
}

export function inputRequiresAttachment(intake) {
  return /用我发的(?:图|图片)|参考我发的(?:图|图片|插画)|按附件|按照附件|见附件/.test(asText(intake.extra_notes));
}

export function attachmentPurpose(intake) {
  const notes = asText(intake.extra_notes);
  if (/插画/.test(notes)) return 'illustration_reference';
  if (/图|图片|附件/.test(notes)) return 'design_reference';
  return '';
}

function hasCoreSpecifics(intake) {
  const notes = compact(intake.extra_notes);
  const keyword = compact(intake.keyword);
  if (keyword.includes('401k') || keyword.includes('401 k')) {
    return /第一屏.*计算器|current age|retirement age|educational estimate|老人|大字体|高对比/.test(notes);
  }
  if (keyword.includes('word counter')) {
    return /words|characters|sentences|paragraphs|reading time|speaking time|实时/.test(notes);
  }
  return notes.length >= 30;
}

function answeredQuestionIds(answeredEvents) {
  return new Set(answeredEvents.map((event) => asText(event.id)).filter(Boolean));
}

function makeQuestion({ intake, index, id, title, message, options, whyNeeded, decisionArea }) {
  const keyword = asText(intake.keyword) || 'this tool';
  const optionDecisions = {};
  options.forEach((option, optionIndex) => {
    optionDecisions[String(optionIndex + 1)] = option.decision;
  });
  return {
    number: index,
    id,
    title,
    decision_area: decisionArea,
    why_needed: whyNeeded,
    message: [
      `${title}`,
      '',
      message,
      '',
      ...options.map((option, optionIndex) => `${optionIndex + 1}. ${option.label}`),
      '5. 其他，请直接描述',
    ].join('\n'),
    option_decisions: {
      ...optionDecisions,
      5: `${keyword} 使用用户自定义补充说明。`,
    },
  };
}

function targetedQuestions(intake, attachments) {
  const keyword = asText(intake.keyword) || 'this tool';
  const domain = asText(intake.target_domain) || 'the target domain';
  const uiReference = asText(intake.ui_reference) || 'the UI reference';
  const uxReference = asText(intake.ux_reference) || 'the UX reference';
  const notes = asText(intake.extra_notes);
  const keywordSlug = slug(keyword);
  const questions = [];

  if (!/input|输入|current age|retirement age|salary|balance|contribution/i.test(notes)) {
    questions.push(
      makeQuestion({
        intake,
        index: questions.length + 1,
        id: `pre-agent2-dynamic-${keywordSlug}-inputs`,
        title: `Pre-Agent2：${keyword} 输入项确认`,
        decisionArea: 'Input / Output Model',
        whyNeeded: `The ${keyword} intake does not yet name the exact input model.`,
        message: `${keyword} 在 ${domain} 的第一屏应该收集哪些核心输入？`,
        options: [
          { label: `只保留 ${keyword} 的最小核心输入`, decision: `${keyword} 输入模型使用最小核心输入。` },
          { label: `覆盖 ${keyword} 的完整但克制输入`, decision: `${keyword} 输入模型覆盖完整但克制的输入。` },
          { label: `按 ${uxReference} 的信息结构组织输入，但不照搬`, decision: `${keyword} 输入模型参考 ${uxReference} 的信息结构但不照搬。` },
          { label: `按 ${uiReference} 的清晰服务式表单组织输入`, decision: `${keyword} 输入模型采用 ${uiReference} 风格的清晰服务式表单。` },
        ],
      }),
    );
  }

  if (!/result|output|输出|balance|contribution|growth|结果|estimate|估算/i.test(notes)) {
    questions.push(
      makeQuestion({
        intake,
        index: questions.length + 1,
        id: `pre-agent2-dynamic-${keywordSlug}-results`,
        title: `Pre-Agent2：${keyword} 结果区确认`,
        decisionArea: 'Result Experience',
        whyNeeded: `The ${keyword} intake does not yet describe the concrete output results.`,
        message: `${keyword} 的结果区应该优先展示哪些具体结果？`,
        options: [
          { label: `突出 ${keyword} 的一个主结果`, decision: `${keyword} 结果区突出一个主结果。` },
          { label: `展示 ${keyword} 的主结果和关键拆分项`, decision: `${keyword} 结果区展示主结果和关键拆分项。` },
          { label: `先给 ${keyword} 估算结果，再给少量解释`, decision: `${keyword} 结果区先给估算结果，再给少量解释。` },
          { label: `允许用户调整输入后实时刷新 ${keyword} 结果`, decision: `${keyword} 结果区随输入调整实时刷新。` },
        ],
      }),
    );
  }

  if (!/不要|不做|no |without |educational|隐私|本地|local/i.test(notes)) {
    questions.push(
      makeQuestion({
        intake,
        index: questions.length + 1,
        id: `pre-agent2-dynamic-${keywordSlug}-boundaries`,
        title: `Pre-Agent2：${keyword} 边界确认`,
        decisionArea: 'Non-goals',
        whyNeeded: `The ${keyword} intake does not yet name enough product/legal boundaries.`,
        message: `${keyword} 第一版需要明确排除哪些能力或风险？`,
        options: [
          { label: `只做 ${keyword} 工具本体，不做账户或保存`, decision: `${keyword} 第一版只做工具本体，不做账户或保存。` },
          { label: `强调 ${keyword} 结果仅供参考`, decision: `${keyword} 结果仅供参考，不构成专业建议。` },
          { label: `保持 ${keyword} 静态前端、本地计算`, decision: `${keyword} 保持静态前端和本地计算。` },
          { label: `不增加 ${keyword} 之外的扩展功能`, decision: `${keyword} 不增加已确认范围外的扩展功能。` },
        ],
      }),
    );
  }

  if (attachments.length > 0 && inputRequiresAttachment(intake) && !attachmentPurpose(intake)) {
    questions.push(
      makeQuestion({
        intake,
        index: questions.length + 1,
        id: `pre-agent2-dynamic-${keywordSlug}-visual-reference`,
        title: `Pre-Agent2：${keyword} 附件用途确认`,
        decisionArea: 'UI / UX Direction',
        whyNeeded: `The ${keyword} intake includes an image but does not explain its intended design role.`,
        message: `${keyword} 已收到附件图片。它应该承担什么视觉作用？`,
        options: [
          { label: `作为 ${keyword} 的轻量插画点缀`, decision: `${keyword} 附件图片作为轻量插画点缀。` },
          { label: `作为 ${keyword} 的视觉风格参考`, decision: `${keyword} 附件图片作为视觉风格参考。` },
          { label: `只在 ${keyword} 下方内容中使用`, decision: `${keyword} 附件图片只在下方内容中使用。` },
          { label: `先不用附件图片`, decision: `${keyword} 暂不使用附件图片。` },
        ],
      }),
    );
  }

  return questions.slice(0, MAX_TARGETED_QUESTIONS);
}

export function planPreAgent2Questions({ intake, attachments = [], answeredEvents = [] } = {}) {
  const missingFields = ['keyword', 'target_domain', 'ui_reference', 'ux_reference', 'extra_notes'].filter(
    (field) => !asText(intake?.[field]),
  );
  if (missingFields.length > 0) {
    return {
      information_sufficient: false,
      missing_fields: missingFields,
      questions: [],
      reason: 'incomplete-intake',
    };
  }

  if (hasCoreSpecifics(intake)) {
    return {
      information_sufficient: true,
      missing_fields: [],
      questions: [],
      reason: 'complete-intake',
    };
  }

  const existing = answeredQuestionIds(answeredEvents);
  const questions = targetedQuestions(intake, attachments).filter((question) => !existing.has(question.id));

  if (answeredEvents.length >= MAX_TARGETED_QUESTIONS) {
    return {
      information_sufficient: true,
      missing_fields: [],
      questions: [],
      reason: 'max-targeted-questions-reached',
      uncertain_items: questions.map((question) => question.why_needed),
    };
  }

  return {
    information_sufficient: questions.length === 0,
    missing_fields: [],
    questions,
    reason: questions.length === 0 ? 'complete-intake' : 'targeted-gaps',
  };
}
