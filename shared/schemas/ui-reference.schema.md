# UI Reference Object Schema

```yaml
ui_reference:
  provided: boolean
  design_generation_mode: reference-guided | open-exploration
  references:
    - type: mood | component | layout | illustration | interaction
      url: string | null
      desktop_screenshot: string | null
      mobile_screenshot: string | null
      component_image: string | null
      reference_strength: mood | component | layout
      notes: string
      borrow:
        - color direction
        - card feeling
        - illustration mood
        - layout rhythm
        - component details
        - interaction behavior
      avoid:
        - exact copying
        - brand assets
        - logos
        - trademarked elements
        - protected illustrations
        - one-to-one layout cloning
        - reference copywriting
  open_exploration:
    suggested_directions: string[]
    anti_patterns: string[]
    tool_specific_constraints: string[]
```
