import type { LearnModule } from '../types'

// Beam bending (task 67): Solid Mechanics → Mechanics of Materials → Beam bending → Cantilever
// Beam I. Five predict-then-check steps on the demo cantilever (learn/beamDemo.ts), then Apply it.
// Every correct option is verified against the physics in beamBending.test.ts (LRN-04). Wording
// awaits owner engineering review (29.2).

export const beamBending: LearnModule = {
  id: 'beam-bending',
  version: 1,
  title: 'Beam bending',
  summary: 'What makes a beam bend less: load, length, material and the shape of its cross-section.',
  time: '15–20 min',
  art: 'beam',
  steps: [
    {
      id: 'load',
      title: 'Load and deflection',
      concept: [
        'A cantilever is fixed at one end and free at the other, like a shelf bracket or a diving board.',
        'A load at the free end bends the beam; how far the tip moves down is its deflection.',
      ],
      question: {
        prompt: 'If you double the load at the tip, what happens to the tip deflection?',
        options: [
          { id: 'same', label: 'It stays the same' },
          { id: 'double', label: 'It doubles' },
          { id: 'quadruple', label: 'It becomes four times larger' },
          { id: 'half', label: 'It halves' },
        ],
        answerId: 'double',
        explanation: 'For an elastic beam, deflection is proportional to load: twice the load gives twice the deflection.',
      },
      demo: 'load',
      tryIt: 'Set the load to 100 N, then 200 N, and compare the tip deflection.',
      takeaway: 'Deflection grows in proportion to the load.',
      advanced: [
        { tex: String.raw`\delta = \dfrac{F L^{3}}{3 E I}`, text: 'δ = FL³ ÷ 3EI', caption: 'Tip deflection: F appears once on top, so δ is proportional to F' },
      ],
    },
    {
      id: 'length',
      title: 'Length',
      concept: [
        'A longer beam gives the load more leverage over the fixed end.',
        'It also has more length over which to bend.',
      ],
      question: {
        prompt: 'Keep the same beam and load, but double its length. The tip deflection becomes…',
        options: [
          { id: 'x2', label: 'Twice as large' },
          { id: 'x4', label: 'Four times as large' },
          { id: 'x8', label: 'Eight times as large' },
          { id: 'x16', label: 'Sixteen times as large' },
        ],
        answerId: 'x8',
        explanation: 'Deflection grows with the cube of the length, so doubling the length multiplies it by 2 × 2 × 2 = 8.',
      },
      demo: 'length',
      tryIt: 'Set the length to 0.5 m, then 1 m, and compare the tip deflection.',
      takeaway: 'Length is the strongest lever: deflection grows with its cube.',
      advanced: [
        { tex: String.raw`\delta \propto L^{3} \quad\Rightarrow\quad \dfrac{\delta(2L)}{\delta(L)} = 2^{3} = 8`, text: 'δ ∝ L³, so δ(2L) ÷ δ(L) = 8', caption: 'The leverage (L) and the bending length (L²) multiply' },
      ],
    },
    {
      id: 'material',
      title: 'Material stiffness',
      concept: [
        "A material's stiffness is its Young's modulus E: how much stress it takes to stretch it.",
        'Steel is about three times stiffer than aluminium, and timber is much less stiff than either.',
      ],
      question: {
        prompt: 'The same beam is made of aluminium instead of steel. Its tip deflection is…',
        options: [
          { id: 'same', label: 'About the same' },
          { id: 'x1.5', label: 'About 1.5 times larger' },
          { id: 'x3', label: 'About 3 times larger' },
          { id: 'x10', label: 'About 10 times larger' },
        ],
        answerId: 'x3',
        explanation: 'Deflection is inversely proportional to E. Steel (200 GPa) is about 2.9 times stiffer than aluminium (69 GPa), so aluminium deflects about 2.9 times as much.',
      },
      demo: 'material',
      tryIt: 'Switch between steel and aluminium and compare the tip deflection.',
      takeaway: 'Stiffer material, less deflection. Stiffness is not the same as strength.',
      advanced: [
        { tex: String.raw`\sigma = E\,\varepsilon`, text: 'σ = E·ε', caption: "Young's modulus links stress and strain in the elastic range" },
        { tex: String.raw`\delta \propto \dfrac{1}{E}`, text: 'δ ∝ 1 ÷ E', caption: 'E is on the bottom of the deflection formula' },
      ],
    },
    {
      id: 'section',
      title: 'Shape of the cross-section',
      concept: [
        'How a section resists bending is its second moment of area, I.',
        'Material far from the middle (the neutral axis) counts much more than material near it.',
      ],
      question: {
        prompt: 'Turn a 40 × 20 mm bar from lying flat to standing upright. Same bar, same load. The tip deflection becomes…',
        options: [
          { id: 'same', label: 'The same' },
          { id: 'half', label: 'Half as large' },
          { id: 'quarter', label: 'A quarter as large' },
          { id: 'sixteenth', label: 'A sixteenth as large' },
        ],
        answerId: 'quarter',
        explanation: 'For a rectangle, I grows with the cube of its depth. Upright, the bar is twice as deep but half as wide, so I is 2³ ÷ 2 = 4 times larger and the deflection is a quarter.',
      },
      demo: 'section',
      tryIt: 'Compare the flat and upright bar, then try the I-section and the tube. All have about the same area.',
      takeaway: 'Put material far from the neutral axis. That is why beams are deep and I-sections work.',
      advanced: [
        { tex: String.raw`I_{\text{rect}} = \dfrac{b\,h^{3}}{12}`, text: 'I = bh³ ÷ 12', caption: 'Rectangle of width b and depth h' },
        { tex: String.raw`\dfrac{I_{\text{upright}}}{I_{\text{flat}}} = \dfrac{h^{2}}{b^{2}} = \left(\dfrac{40}{20}\right)^{2} = 4`, text: 'I_upright ÷ I_flat = (40 ÷ 20)² = 4', caption: 'Same area, turned on its edge' },
      ],
    },
    {
      id: 'stress',
      title: 'Where the stress is',
      concept: [
        'The load acts on a lever arm: the bending moment at any point is the load times its distance to the tip.',
        'Bending stretches one face of the beam and squashes the other; the neutral axis between them carries no bending stress.',
      ],
      question: {
        prompt: 'Where is the bending stress highest in this cantilever?',
        options: [
          { id: 'tip', label: 'At the loaded tip' },
          { id: 'middle', label: 'Halfway along the beam' },
          { id: 'rootSurface', label: 'At the fixed end, on the top and bottom surfaces' },
          { id: 'rootCentre', label: 'At the fixed end, along the centre line' },
        ],
        answerId: 'rootSurface',
        explanation: 'The moment is largest at the fixed end, where the lever arm is the whole length. Stress grows with distance from the neutral axis, so it peaks on the top surface (tension) and the bottom surface (compression).',
      },
      demo: 'stress',
      tryIt: 'Move the position from the tip to the fixed end and watch the moment and the surface stresses.',
      takeaway: 'Bending stress peaks at the fixed end, on the outer surfaces. That is where strength checks matter most.',
      advanced: [
        { tex: String.raw`M(x) = F\,(L - x)`, text: 'M(x) = F·(L − x)', caption: 'Moment at distance x from the fixed end' },
        { tex: String.raw`\sigma = \dfrac{M\,y}{I}, \qquad \sigma_{\max} = \dfrac{M\,c}{I}`, text: 'σ = My ÷ I, σ_max = Mc ÷ I', caption: 'Stress at height y; c is the distance to the outer surface' },
      ],
    },
  ],
  apply: {
    challengeId: 'cantilever-beam-1',
    title: 'Cantilever Beam I',
    text: 'A cantilevered component deflects too much and is too heavy. The span, material and load are fixed, so the cross-section is your lever: shape it to meet the stiffness, stress and mass limits.',
  },
}
