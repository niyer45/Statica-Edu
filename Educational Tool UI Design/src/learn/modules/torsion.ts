import type { LearnModule } from '../types'

// Torsion (task 71, D-61): Solid Mechanics → Mechanics of Materials → Torsion → Torsion Shaft I.
// Five predict-then-check steps on the demo shaft (learn/torsionDemo.ts), then Apply it. Every
// correct option is verified against the physics in torsion.test.ts (LRN-04). Wording awaits
// owner engineering review (29.2).

export const torsion: LearnModule = {
  id: 'torsion',
  version: 1,
  title: 'Torsion',
  summary: 'How shafts twist: torque, length, diameter, hollow sections and where the shear stress is.',
  time: '15–20 min',
  art: 'shaft',
  steps: [
    {
      id: 'torque',
      title: 'Torque and twist',
      concept: [
        'A shaft carries torque, a turning moment, like a wrench on a bolt or a motor driving a wheel.',
        'With one end held, torque twists the shaft; how far the free end turns is the angle of twist.',
        'Twisting also creates shear stress inside the material.',
      ],
      question: {
        prompt: 'If you double the torque on the shaft, what happens to the angle of twist?',
        options: [
          { id: 'same', label: 'It stays the same' },
          { id: 'double', label: 'It doubles' },
          { id: 'quadruple', label: 'It becomes four times larger' },
          { id: 'half', label: 'It halves' },
        ],
        answerId: 'double',
        explanation: 'For an elastic shaft the angle of twist is proportional to the torque: twice the torque gives twice the twist, and twice the shear stress.',
      },
      demo: 'torsion-torque',
      tryIt: 'Set the torque to 50 N·m, then 100 N·m, and compare the angle of twist.',
      takeaway: 'Twist and shear stress grow in proportion to the torque.',
      advanced: [
        { tex: String.raw`\varphi = \dfrac{T L}{G J}`, text: 'φ = TL ÷ GJ', caption: 'Angle of twist in radians: T appears once on top, so φ is proportional to T' },
      ],
    },
    {
      id: 'length',
      title: 'Length',
      concept: [
        'Each short slice of a shaft twists a little relative to its neighbour.',
        'A longer shaft has more slices, so their twists add up along its length.',
      ],
      question: {
        prompt: 'Keep the same shaft and torque, but double its length. The angle of twist becomes…',
        options: [
          { id: 'same', label: 'The same' },
          { id: 'x2', label: 'Twice as large' },
          { id: 'x4', label: 'Four times as large' },
          { id: 'x8', label: 'Eight times as large' },
        ],
        answerId: 'x2',
        explanation: 'The angle of twist is proportional to the length: twice the length, twice the twist. Unlike a bending cantilever there is no extra leverage, and the shear stress does not change at all.',
      },
      demo: 'torsion-length',
      tryIt: 'Set the length to 0.5 m, then 1 m, and compare the angle of twist and the shear stress.',
      takeaway: 'Twist grows in proportion to length; the shear stress does not depend on length.',
      advanced: [
        { tex: String.raw`\varphi \propto L \quad\Rightarrow\quad \dfrac{\varphi(2L)}{\varphi(L)} = 2`, text: 'φ ∝ L, so φ(2L) ÷ φ(L) = 2', caption: 'The slices twist in series' },
        { tex: String.raw`\tau_{\max} = \dfrac{T c}{J}`, text: 'τ_max = Tc ÷ J', caption: 'No L in the stress: a longer shaft twists more but is not more stressed' },
      ],
    },
    {
      id: 'diameter',
      title: 'Diameter',
      concept: [
        'How a cross-section resists twisting is its polar moment of area, J.',
        'Material far from the centre counts much more: it strains more and has a longer lever arm.',
      ],
      question: {
        prompt: 'Double the diameter of a solid shaft from 20 mm to 40 mm. Same torque. The angle of twist becomes…',
        options: [
          { id: 'half', label: 'Half as large' },
          { id: 'quarter', label: 'A quarter as large' },
          { id: 'eighth', label: 'An eighth as large' },
          { id: 'sixteenth', label: 'A sixteenth as large' },
        ],
        answerId: 'sixteenth',
        explanation: 'J grows with the fourth power of the diameter, so doubling it makes J 2 × 2 × 2 × 2 = 16 times larger and the twist a sixteenth. The peak shear stress falls to an eighth, because the surface is also twice as far out.',
      },
      demo: 'torsion-diameter',
      tryIt: 'Set the diameter to 20 mm, then 40 mm, and compare J, the angle of twist and the shear stress.',
      takeaway: 'Diameter is the strongest lever: twist falls with its fourth power.',
      advanced: [
        { tex: String.raw`J_{\text{solid}} = \dfrac{\pi d^{4}}{32}`, text: 'J = πd⁴ ÷ 32', caption: 'Polar moment of a solid round shaft of diameter d' },
        { tex: String.raw`\dfrac{J(2d)}{J(d)} = 2^{4} = 16`, text: 'J(2d) ÷ J(d) = 2⁴ = 16', caption: 'So the twist, which is proportional to 1/J, falls to a sixteenth' },
      ],
    },
    {
      id: 'hollow',
      title: 'Hollow or solid',
      concept: [
        'Material near the centre of a shaft barely strains, so it carries little of the torque.',
        'A tube moves the same amount of material further out, where it does the most work.',
      ],
      question: {
        prompt: 'A solid 20 mm bar and a 29 mm tube with a 21 mm bore contain exactly the same amount of steel. Under the same torque, which twists less?',
        options: [
          { id: 'solid', label: 'The solid bar' },
          { id: 'same', label: 'Neither: the same steel twists the same' },
          { id: 'tube', label: 'The tube' },
          { id: 'depends', label: 'It depends on the torque' },
        ],
        answerId: 'tube',
        explanation: "The tube's material sits further from the centre, so its J is about 3.2 times the bar's and it twists less than a third as much, for the same mass.",
      },
      demo: 'torsion-hollow',
      tryIt: 'Compare the solid bar with the two tubes. All three have the same cross-section area, so the same mass per metre.',
      takeaway: 'For stiffness per kilogram, put the material far from the centre: hollow shafts are efficient.',
      advanced: [
        { tex: String.raw`J_{\text{tube}} = \dfrac{\pi\,(D^{4} - d^{4})}{32}`, text: 'J = π(D⁴ − d⁴) ÷ 32', caption: 'Tube of outer diameter D and bore d' },
        { tex: String.raw`A = \dfrac{\pi\,(D^{2} - d^{2})}{4}, \qquad 29^{2} - 21^{2} = 20^{2}`, text: 'A = π(D² − d²) ÷ 4, and 29² − 21² = 20²', caption: 'Same area, so the same mass, as the 20 mm bar' },
      ],
    },
    {
      id: 'stress',
      title: 'Where the shear stress is',
      concept: [
        'Twisting shears each cross-section, like the cards of a deck sliding over each other.',
        'The further a point is from the centre, the further it moves as the shaft twists.',
      ],
      question: {
        prompt: 'Where is the shear stress highest in a twisted solid shaft?',
        options: [
          { id: 'centre', label: 'At the centre' },
          { id: 'middle', label: 'Halfway between the centre and the surface' },
          { id: 'surface', label: 'At the outer surface' },
          { id: 'uniform', label: 'It is the same everywhere in the section' },
        ],
        answerId: 'surface',
        explanation: 'Shear stress is proportional to the distance from the centre: zero on the axis and highest at the outer surface. That is also why the core of a solid shaft does so little work.',
      },
      demo: 'torsion-stress',
      tryIt: 'Move the point from the centre to the surface and watch the shear stress.',
      takeaway: 'Shear stress peaks at the outer surface, so strength checks look there, and the core does little work.',
      advanced: [
        { tex: String.raw`\tau(r) = \dfrac{T\,r}{J}`, text: 'τ(r) = Tr ÷ J', caption: 'Shear stress at radius r from the axis' },
        { tex: String.raw`\tau_{\max} = \dfrac{T c}{J}, \qquad c = \dfrac{D}{2}`, text: 'τ_max = Tc ÷ J, c = D ÷ 2', caption: 'The peak, at the outer surface' },
      ],
    },
  ],
  apply: {
    challengeId: 'torsion-shaft-1',
    title: 'Torsion Shaft I',
    text: 'A solid steel drive shaft twists too much and is over its mass limit. The length, material and torque are fixed, so the cross-section is your lever: use what you found about J to make it twist less while weighing less.',
  },
}
