// Dummy resume used to preview templates in the gallery.
export const SAMPLE_RESUME = {
  header: {
    name: "Alex Morgan",
    title: "Full-Stack Software Engineer",
    email: "alex.morgan@email.com",
    phone: "(555) 234-1980",
    location: "Austin, TX",
    links: ["github.com/alexmorgan", "linkedin.com/in/alexmorgan"],
  },
  summary:
    "Full-stack engineer with 6 years building reliable web apps. Shipped products used by 200k+ users, led a team of 4, and cut infrastructure costs by 35% through targeted optimization.",
  skills: ["JavaScript", "TypeScript", "React", "Node.js", "Python", "PostgreSQL", "AWS", "Docker", "GraphQL", "CI/CD"],
  experience: [
    { company: "Brightwave", role: "Senior Software Engineer", start: "2022", end: "Present", location: "Austin, TX",
      bullets: [
        "Led migration to a microservices architecture, improving deploy frequency 4x and cutting p95 latency by 38%.",
        "Mentored 4 engineers and introduced code-review standards that reduced production incidents by 27%.",
        "Built a GraphQL gateway consolidating 9 REST services into one typed API.",
      ] },
    { company: "Nimbus Labs", role: "Software Engineer", start: "2019", end: "2022", location: "Remote",
      bullets: [
        "Delivered a React + Node billing dashboard adopted by 12k businesses.",
        "Automated CI/CD with GitHub Actions, reducing release time from 45 min to 7 min.",
      ] },
  ],
  projects: [
    { name: "OpenSchedule", tech: "Next.js, Postgres", bullets: ["Open-source scheduling app with 1.2k GitHub stars and 30+ contributors."] },
  ],
  education: [
    { school: "University of Texas at Austin", degree: "B.S. Computer Science", year: "2019", details: "GPA 3.8 · Dean's List" },
  ],
  certifications: ["AWS Certified Solutions Architect – Associate"],
  achievements: ["1st place, StateHacks 2021 (200+ teams)"],
};
