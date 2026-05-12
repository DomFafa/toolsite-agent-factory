// Production run behavior is governed by docs/production-run-master-contract.md.
// If this entrypoint conflicts with the contract, the contract wins.
// Pre-Agent2 must use dynamic gap analysis, keep fixed generic Q1-Q12 out of user flows, treat image attachments as design_reference / illustration_reference by default, and generate SPEC only when information is sufficient under the hard cap.
const MAX_DYNAMIC_QUESTIONS = 30;

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
  return /用我发的(?:图|图片)|参考我发的(?:图|图片|插画)|黑白人物插画|附图|截图|插画参考|按附件|按照附件|见附件/.test(asText(intake.extra_notes));
}

export function attachmentPurpose(intake) {
  const notes = asText(intake.extra_notes);
  if (/插画|插画参考|黑白人物/.test(notes)) return 'illustration_reference';
  if (/图|图片|附件|附图|截图/.test(notes)) return 'design_reference';
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

function is401kIntake(intake) {
  const value = compact(`${intake?.keyword || ''} ${intake?.target_domain || ''}`);
  return value.includes('401k') || value.includes('401-k') || value.includes('401 k');
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

function fourOhOneKQuestions(intake) {
  const questions = [];
  const add = (question) => {
    questions.push({ ...question, index: questions.length + 1 });
  };

  add({
    id: 'pre-agent2-dynamic-401k-calculator-complexity',
    title: 'Pre-Agent2：401K Calculator 计算复杂度确认',
    decisionArea: 'Input / Output Model',
    whyNeeded: '401K Calculator 的计算复杂度会决定输入数量、默认假设、结果解释和老人友好程度。',
    message: '401K Calculator 第一版计算复杂度选哪一档？',
    options: [
      { label: '简化版：输入少，适合老人快速估算', decision: '401K Calculator 第一版使用简化输入，优先适合老人快速估算。' },
      { label: '标准版：包含年龄、退休年龄、当前余额、工资、缴费比例、雇主匹配、预期收益率、工资增长', decision: '401K Calculator 第一版使用标准输入，覆盖 current age、retirement age、current balance、salary、employee contribution、employer match、expected return 和 salary increase。' },
      { label: '详细版：增加 catch-up contribution、annual limit、通胀等高级项', decision: '401K Calculator 第一版使用详细输入，增加 catch-up contribution、annual limit 和通胀等高级项。' },
      { label: '先按标准版生成 SPEC，但在审核卡里标注默认假设', decision: '401K Calculator 第一版按标准版生成 SPEC，并明确默认假设。' },
    ],
  });

  add({
    id: 'pre-agent2-dynamic-401k-calculator-default-assumptions',
    title: 'Pre-Agent2：401K Calculator 默认假设确认',
    decisionArea: 'Input / Output Model',
    whyNeeded: '默认假设会影响 401K Calculator 的初始结果可信度，也会影响老人用户是否能直接上手。',
    message: '401K Calculator 的默认假设要怎么设置？',
    options: [
      { label: '保守默认：expected return 5%，salary increase 2%，retirement age 65', decision: '401K Calculator 使用保守默认：expected return 5%，salary increase 2%，retirement age 65。' },
      { label: '标准默认：expected return 6%，salary increase 3%，retirement age 67', decision: '401K Calculator 使用标准默认：expected return 6%，salary increase 3%，retirement age 67。' },
      { label: '积极默认：expected return 7%，salary increase 3%，retirement age 67', decision: '401K Calculator 使用积极默认：expected return 7%，salary increase 3%，retirement age 67。' },
      { label: '不设默认值，让用户自己填写', decision: '401K Calculator 不预设默认值，让用户自己填写关键假设。' },
    ],
  });

  add({
    id: 'pre-agent2-dynamic-401k-calculator-employer-match',
    title: 'Pre-Agent2：401K Calculator employer match 规则确认',
    decisionArea: 'Input / Output Model',
    whyNeeded: 'employer match 是 401K Calculator 估算结果的重要来源，必须在 SPEC 里明确第一版规则。',
    message: 'employer match 第一版按哪种规则处理？',
    options: [
      { label: '简单百分比：雇主按 salary 的固定百分比匹配', decision: 'employer match 使用 salary 固定百分比的简化规则。' },
      { label: '常见规则：100% match up to 3%，再 50% match up to 5%', decision: 'employer match 使用常见分段匹配规则：100% match up to 3%，再 50% match up to 5%。' },
      { label: '让用户输入 match percentage 和 match cap', decision: 'employer match 由用户输入 match percentage 和 match cap。' },
      { label: '第一版先弱化 employer match，只展示为可选输入', decision: 'employer match 第一版作为可选输入，避免过度复杂。' },
    ],
  });

  add({
    id: 'pre-agent2-dynamic-401k-calculator-result-display',
    title: 'Pre-Agent2：401K Calculator 结果展示确认',
    decisionArea: 'Result Experience',
    whyNeeded: '结果展示方式决定用户能否快速理解 retirement estimate，而不误认为这是财务建议。',
    message: '401K Calculator 的结果区第一版应该怎么展示？',
    options: [
      { label: '只突出 estimated balance at retirement 和关键说明', decision: '结果区优先突出 estimated balance at retirement 和关键说明。' },
      { label: '展示最终余额 + total contributions + employer match + investment growth', decision: '结果区展示最终余额、total contributions、employer match 和 investment growth。' },
      { label: '在拆分项之外增加简单 chart', decision: '结果区在拆分项之外增加简单 chart。' },
      { label: '先不要 chart，避免干扰老人用户理解', decision: '结果区第一版不放 chart，优先保持阅读清晰。' },
    ],
  });

  add({
    id: 'pre-agent2-dynamic-401k-calculator-senior-input',
    title: 'Pre-Agent2：401K Calculator 老人友好输入方式确认',
    decisionArea: 'First Viewport UX',
    whyNeeded: '老人友好输入方式会影响第一屏布局、字号、对比度和高级项是否折叠。',
    message: '老人友好输入方式第一版选哪种？',
    options: [
      { label: '一屏完成：所有标准输入都在第一屏或紧邻第一屏', decision: '老人友好输入采用一屏完成，标准输入集中展示。' },
      { label: '分组输入：基础信息、贡献、假设分成 3 个清晰区块', decision: '老人友好输入采用分组输入：基础信息、贡献、假设。' },
      { label: '基础项优先，高级假设折叠', decision: '老人友好输入采用基础项优先，高级假设折叠。' },
      { label: '用 step-by-step，但保持无登录和本地计算', decision: '老人友好输入采用 step-by-step，同时保持无登录和本地计算。' },
    ],
  });

  return questions.map((question) => makeQuestion({
    intake,
    index: question.index,
    id: question.id,
    title: question.title,
    decisionArea: question.decisionArea,
    whyNeeded: question.whyNeeded,
    message: question.message,
    options: question.options,
  }));
}

function targetedQuestions(intake, attachments) {
  if (is401kIntake(intake)) return fourOhOneKQuestions(intake);

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

  return questions;
}

export function planPreAgent2Questions({ intake, attachments = [], answeredEvents = [] } = {}) {
  const missingFields = ['keyword', 'target_domain', 'ui_reference', 'ux_reference', 'extra_notes'].filter(
    (field) => !asText(intake?.[field]),
  );
  if (missingFields.length > 0) {
    return {
      information_sufficient: false,
      missing_fields: missingFields,
      missing_decision_areas: missingFields,
      questions: [],
      next_question: null,
      why_this_question_matters: '',
      estimated_remaining_questions: 0,
      reason: 'incomplete-intake',
    };
  }

  if (!is401kIntake(intake) && hasCoreSpecifics(intake)) {
    return {
      information_sufficient: true,
      missing_fields: [],
      missing_decision_areas: [],
      questions: [],
      next_question: null,
      why_this_question_matters: '',
      estimated_remaining_questions: 0,
      reason: 'complete-intake',
    };
  }

  const existing = answeredQuestionIds(answeredEvents);
  const questions = targetedQuestions(intake, attachments).filter((question) => !existing.has(question.id));

  if (answeredEvents.length >= MAX_DYNAMIC_QUESTIONS) {
    return {
      information_sufficient: true,
      missing_fields: [],
      missing_decision_areas: questions.map((question) => question.decision_area),
      questions: [],
      next_question: null,
      why_this_question_matters: '',
      estimated_remaining_questions: 0,
      reason: 'max-targeted-questions-reached',
      uncertain_items: questions.map((question) => question.why_needed),
    };
  }

  const nextQuestion = questions[0] || null;
  return {
    information_sufficient: questions.length === 0,
    missing_fields: [],
    missing_decision_areas: questions.map((question) => question.decision_area),
    questions,
    next_question: nextQuestion,
    why_this_question_matters: nextQuestion?.why_needed || '',
    estimated_remaining_questions: questions.length,
    reason: questions.length === 0 ? 'complete-intake' : 'targeted-gaps',
  };
}
