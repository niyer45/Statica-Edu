export type Challenge = {
  id: string
  title: string
  description: string
  discipline: string
  difficulty: string
  time: string
  concepts: string[]
  available: boolean
  art: string
}
export const challenges: Challenge[] = [
  {
    id: "001",
    title: "Cantilever Beam I",
    description:
      "Reduce tip deflection within mass and stress limits.",
    discipline: "Mechanics",
    difficulty: "Introductory",
    time: "15–20 min",
    concepts: ["Bending", "Material efficiency"],
    available: true,
    art: "beam",
  },
  {
    id: "002",
    title: "Mounting Bracket I",
    description:
      "Rethink a mounting bracket that carries more stress than it should.",
    discipline: "Structures",
    difficulty: "Intermediate",
    time: "25–35 min",
    concepts: ["Load paths", "Stress concentrations"],
    available: false,
    art: "bracket",
  },
  {
    id: "003",
    title: "Torsion Shaft I",
    description:
      "Balance torsional stiffness, weight, and packaging in a rotating shaft.",
    discipline: "Mechanics",
    difficulty: "Intermediate",
    time: "20–30 min",
    concepts: ["Torsion", "Section properties"],
    available: false,
    art: "shaft",
  },
  {
    id: "004",
    title: "Heat Sink I",
    description:
      "Explore how geometry helps a compact heat sink move heat away.",
    discipline: "Thermal",
    difficulty: "Intermediate",
    time: "25–35 min",
    concepts: ["Heat transfer", "Surface area"],
    available: false,
    art: "thermal",
  },
  {
    id: "005",
    title: "Braced Frame I",
    description:
      "Follow the forces through a frame and strengthen what matters.",
    discipline: "Structures",
    difficulty: "Advanced",
    time: "35–45 min",
    concepts: ["Frame analysis", "Stability"],
    available: false,
    art: "frame",
  },
  {
    id: "006",
    title: "Vibration Isolation I",
    description:
      "Tune a component to keep unwanted vibration out of its operating range.",
    discipline: "Dynamics",
    difficulty: "Advanced",
    time: "30–40 min",
    concepts: ["Natural frequency", "Vibration"],
    available: false,
    art: "spring",
  },
]
