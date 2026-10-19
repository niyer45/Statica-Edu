import type { LearnModule } from '../types'

// Stress and strain (task 72; stress-strain-1 SSL-01–SSL-06): Solid Mechanics → Mechanics of
// Materials → Stress and strain → Stress and Strain I. Five predict-then-check steps on the demo rod
// (learn/axialDemo.ts), then Apply it. Every correct option is verified against the physics in
// stressStrain.test.ts (LRN-04). Material values are typical textbook values. Wording awaits owner
// engineering review (29.2).

export const stressStrain: LearnModule = {
  id: 'stress-strain',
  version: 1,
  title: 'Stress and strain',
  summary: 'Stress, strain, stiffness and strength in a rod pulled along its axis, and why they are not the same thing.',
  time: '15–20 min',
  art: 'rod',
  steps: [
    {
      id: 'area',
      title: 'Stress: force over area',
      concept: [
        'Stress is the force carried per unit of cross-sectional area: σ = P ÷ A. Engineers usually quote it in megapascals (MPa).',
        'A rod in tension carries the same force through every cross-section, so a smaller area means a higher stress.',
      ],
      question: {
        prompt: 'A rod carries the same load, but its diameter is doubled. Its stress becomes…',
        options: [
          { id: 'half', label: 'Half as large' },
          { id: 'quarter', label: 'A quarter as large' },
          { id: 'same', label: 'The same' },
          { id: 'double', label: 'Twice as large' },
        ],
        answerId: 'quarter',
        explanation: 'The area of a circle grows with the square of its diameter, so twice the diameter gives four times the area. The same force spread over four times the area gives a quarter of the stress.',
      },
      demo: 'axial-area',
      tryIt: 'Set the diameter to 10 mm, then 20 mm, and compare the stress.',
      takeaway: 'Stress depends on the load and the area: double the diameter, a quarter of the stress.',
      advanced: [
        { tex: String.raw`\sigma = \dfrac{P}{A}, \qquad A = \dfrac{\pi d^{2}}{4}`, text: 'σ = P ÷ A, A = πd² ÷ 4', caption: 'Axial stress in a solid round rod' },
        { tex: String.raw`\dfrac{\sigma(2d)}{\sigma(d)} = \left(\dfrac{d}{2d}\right)^{2} = \dfrac{1}{4}`, text: 'σ(2d) ÷ σ(d) = (d ÷ 2d)² = 1 ÷ 4', caption: 'Same load, twice the diameter' },
      ],
    },
    {
      id: 'strain',
      title: 'Strain: stretch per length',
      concept: [
        'Strain is how much a bar stretches compared with its original length: ε = δ ÷ L. It has no units.',
        'Strain lets you compare bars of different lengths: what matters is the stretch per metre, not the total stretch.',
      ],
      question: {
        prompt: 'Two rods each stretch by 1 mm. One is 1 m long, the other 2 m long. Which has the larger strain?',
        options: [
          { id: 'short', label: 'The 1 m rod' },
          { id: 'long', label: 'The 2 m rod' },
          { id: 'same', label: 'Both the same' },
          { id: 'unknown', label: "You can't tell without knowing the load" },
        ],
        answerId: 'short',
        explanation: 'Strain is the stretch divided by the length: 1 mm over 1 m is twice the strain of 1 mm over 2 m. The shorter rod is stretched twice as hard, and needs twice the stress to do it.',
      },
      demo: 'axial-strain',
      tryIt: 'Set the stretch to 1 mm and switch between the 1 m and the 2 m rod. Compare the strain.',
      takeaway: 'Strain is stretch per unit length: the same stretch in a shorter rod is a larger strain.',
      advanced: [
        { tex: String.raw`\varepsilon = \dfrac{\delta}{L}`, text: 'ε = δ ÷ L', caption: 'Strain: change in length over original length' },
        { tex: String.raw`\dfrac{\varepsilon_{1\,\text{m}}}{\varepsilon_{2\,\text{m}}} = \dfrac{1 / 1}{1 / 2} = 2`, text: 'ε(1 m) ÷ ε(2 m) = 2', caption: 'The same 1 mm stretch on rods of 1 m and 2 m' },
      ],
    },
    {
      id: 'hooke',
      title: "Hooke's law and stiffness",
      concept: [
        "In the elastic range, stress is proportional to strain: σ = E ε. E is Young's modulus, the material's stiffness.",
        "Structural steel's E is about 200 GPa and aluminium's about 69 GPa.",
        'The stress does not depend on the material; the stretch does.',
      ],
      question: {
        prompt: 'The same rod and load, made of aluminium instead of steel. The rod stretches…',
        options: [
          { id: 'same', label: 'About the same' },
          { id: 'x1.5', label: 'About 1.5 times as much' },
          { id: 'x3', label: 'About 3 times as much' },
          { id: 'x10', label: 'About 10 times as much' },
        ],
        answerId: 'x3',
        explanation: 'The stress is the same: same force, same area. Strain is stress divided by E, and steel (200 GPa) is about 2.9 times stiffer than aluminium (69 GPa), so the aluminium rod stretches about 2.9 times as much.',
      },
      demo: 'axial-hooke',
      tryIt: 'Switch between steel, aluminium and titanium. Watch which numbers change and which stay the same.',
      takeaway: 'Stiffer material, less stretch for the same stress. The stress itself is set by the force and the area.',
      advanced: [
        { tex: String.raw`\sigma = E\,\varepsilon \quad\Rightarrow\quad \delta = \dfrac{P L}{A E}`, text: 'σ = E·ε, so δ = PL ÷ AE', caption: "Hooke's law gives the elongation of the rod" },
        { tex: String.raw`\dfrac{\delta_{\text{Al}}}{\delta_{\text{steel}}} = \dfrac{E_{\text{steel}}}{E_{\text{Al}}} = \dfrac{200}{69} \approx 2.9`, text: 'δ_Al ÷ δ_steel = 200 ÷ 69 ≈ 2.9', caption: 'Same rod and load, two materials' },
      ],
    },
    {
      id: 'yield',
      title: 'Yield: strength is not stiffness',
      concept: [
        'Beyond its yield strength σ_y a metal no longer springs back: it deforms permanently. Designs keep the stress well below yield.',
        "Yield strength measures strength; Young's modulus measures stiffness. They are different properties.",
        'Past yield the straight-line model no longer applies. The demo labels that region but does not model it.',
      ],
      question: {
        prompt: 'Structural steel is about three times stiffer than the aluminium alloy 6061-T6. Which can carry the higher stress before it yields?',
        options: [
          { id: 'steel3', label: 'Steel, about three times higher' },
          { id: 'steelBit', label: 'Steel, a little higher' },
          { id: 'similar', label: 'About the same: the aluminium alloy is slightly higher' },
          { id: 'aluminium3', label: 'Aluminium, about three times higher' },
        ],
        answerId: 'similar',
        explanation: 'With these typical values, structural steel yields at about 250 MPa and 6061-T6 aluminium at about 276 MPa. Steel is about three times stiffer, yet this aluminium alloy is slightly stronger: stiffness and strength are different properties.',
      },
      demo: 'axial-yield',
      tryIt: 'Raise the load and watch the stress approach each yield strength. Steel reaches yield first, even though it is the stiffest.',
      takeaway: 'A stiff material is not necessarily a strong one. Check stress against strength, and stretch against stiffness.',
      advanced: [
        { tex: String.raw`\varepsilon_{y} = \dfrac{\sigma_{y}}{E}`, text: 'εy = σy ÷ E', caption: 'Strain at the yield point: where the straight line ends' },
        { tex: String.raw`\sigma \le \dfrac{\sigma_{y}}{n}`, text: 'σ ≤ σy ÷ n', caption: 'A design keeps the stress below yield divided by a design factor n' },
      ],
    },
    {
      id: 'length',
      title: 'Longer rods stretch more',
      concept: [
        'Every metre of a rod under the same stress stretches by the same amount, so the total stretch adds up along the length.',
        'Stress and strain do not depend on the length; the elongation does: δ = ε L.',
      ],
      question: {
        prompt: 'The same rod, load and material, but twice as long. Its elongation becomes…',
        options: [
          { id: 'same', label: 'The same' },
          { id: 'double', label: 'Twice as large' },
          { id: 'x4', label: 'Four times as large' },
          { id: 'half', label: 'Half as large' },
        ],
        answerId: 'double',
        explanation: 'The stress and the strain are unchanged, and the elongation is the strain times the length, so twice the length gives twice the stretch.',
      },
      demo: 'axial-length',
      tryIt: 'Set the length to 2 m, then 4 m, and compare the elongation, the strain and the stress.',
      takeaway: 'Elongation grows in proportion to the length; stress and strain stay the same.',
      advanced: [
        { tex: String.raw`\delta = \varepsilon\,L = \dfrac{P L}{A E}`, text: 'δ = ε·L = PL ÷ AE', caption: 'Elongation is strain times length' },
        { tex: String.raw`\dfrac{\delta(2L)}{\delta(L)} = 2`, text: 'δ(2L) ÷ δ(L) = 2', caption: 'Twice the length, twice the stretch' },
      ],
    },
  ],
  apply: {
    challengeId: 'stress-strain-1',
    title: 'Stress and Strain I',
    text: 'A steel hanger rod is overstressed and too heavy. Its length and load are fixed, so the diameter and the material are your levers: find a rod that is strong enough, stiff enough and light enough.',
  },
}
