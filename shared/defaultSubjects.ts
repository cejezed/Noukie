// Standaard vakken per onderwijsniveau en jaargang
export interface DefaultSubject {
  name: string;
  level: string;
}

export const getDefaultSubjects = (educationLevel: string, grade: string): DefaultSubject[] => {
  const level = `${educationLevel}${grade.split(' ')[1]}`; // e.g. "havo5", "vwo4"
  
  // Basis vakken voor alle niveaus
  const baseSubjects = [
    { name: "Nederlands", level },
    { name: "Engels", level },
  ];
  
  // Niveau-specifieke vakken
  if (educationLevel === "vmbo") {
    return [
      ...baseSubjects,
      { name: "Wiskunde", level },
      { name: "Geschiedenis", level },
      { name: "Aardrijkskunde", level },
      { name: "Biologie", level },
      { name: "Economie", level },
    ];
  }
  
  if (educationLevel === "havo") {
    const subjects = [
      ...baseSubjects,
      { name: "Wiskunde A", level },
      { name: "Wiskunde B", level },
      { name: "Geschiedenis", level },
      { name: "Aardrijkskunde", level },
      { name: "Biologie", level },
      { name: "Scheikunde", level },
      { name: "Natuurkunde", level },
      { name: "Economie", level },
    ];
    
    // Extra vakken voor hogere klassen
    if (grade.includes("4") || grade.includes("5")) {
      subjects.push(
        { name: "Frans", level },
        { name: "Duits", level },
        { name: "Maatschappijleer", level }
      );
    }
    
    return subjects;
  }
  
  if (educationLevel === "vwo") {
    const subjects = [
      ...baseSubjects,
      { name: "Wiskunde A", level },
      { name: "Wiskunde B", level },
      { name: "Wiskunde C", level },
      { name: "Geschiedenis", level },
      { name: "Aardrijkskunde", level },
      { name: "Biologie", level },
      { name: "Scheikunde", level },
      { name: "Natuurkunde", level },
      { name: "Economie", level },
      { name: "Frans", level },
      { name: "Duits", level },
    ];
    
    // Extra vakken voor hogere klassen
    if (grade.includes("5") || grade.includes("6")) {
      subjects.push(
        { name: "Latijn", level },
        { name: "Grieks", level },
        { name: "Filosofie", level },
        { name: "Maatschappijleer", level }
      );
    }
    
    return subjects;
  }
  
  if (educationLevel === "mbo") {
    return [
      ...baseSubjects,
      { name: "Rekenen", level },
      { name: "Maatschappijleer", level },
      { name: "Burgerschap", level },
      { name: "Vakrichting", level }, // Placeholder voor specifieke opleiding
    ];
  }
  
  return baseSubjects;
};