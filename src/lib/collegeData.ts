/* =============================================
   College (Visvesvaraya Technological University)
   Affiliated Engineering Colleges, Courses & Subjects
   Scheme: CBCS 2021
   ============================================= */

export interface College {
    id: string;
    name: string;
    location: string;
}

export interface Course {
    id: string;
    name: string;
    shortName: string;
}

export interface Subject {
    code: string;
    name: string;
}

// ─── Colleges ───────────────────────────────────────────────────────────────
export const College_COLLEGES: College[] = [
    { id: 'rvce', name: 'R V College of Engineering', location: 'Bangalore' },
    { id: 'bmsce', name: 'BMS College of Engineering', location: 'Bangalore' },
    { id: 'msrit', name: 'M S Ramaiah Institute of Technology', location: 'Bangalore' },
    { id: 'dsce', name: 'Dayananda Sagar College of Engineering', location: 'Bangalore' },
    { id: 'sit_tumkur', name: 'Siddaganga Institute of Technology', location: 'Tumkur' },
    { id: 'biet', name: 'Bapuji Institute of Engineering and Technology', location: 'Davangere' },
    { id: 'nie', name: 'National Institute of Engineering', location: 'Mysore' },
    { id: 'sjce', name: 'Sri Jayachamarajendra College of Engineering', location: 'Mysore' },
    { id: 'vvce', name: 'Vidyavardhaka College of Engineering', location: 'Mysore' },
    { id: 'msce', name: 'Maharaja Institute of Technology', location: 'Mysore' },
    { id: 'sdmit', name: 'SDM Institute of Technology', location: 'Ujire' },
    { id: 'nitte', name: 'NMAM Institute of Technology', location: 'Nitte' },
    { id: 'atme', name: 'ATME College of Engineering', location: 'Mysore' },
    { id: 'brce', name: 'Bheemanna Khandre Institute of Technology', location: 'Bidar' },
    { id: 'gmit', name: 'GM Institute of Technology', location: 'Davangere' },
    { id: 'hkbk', name: 'HKBK College of Engineering', location: 'Bangalore' },
    { id: 'jssate', name: 'JSS Academy of Technical Education', location: 'Bangalore' },
    { id: 'kssem', name: 'K S School of Engineering and Management', location: 'Bangalore' },
    { id: 'east_west', name: 'East West Institute of Technology', location: 'Bangalore' },
    { id: 'git_belgaum', name: 'Gogte Institute of Technology', location: 'Belagavi' },
    { id: 'bit_belgaum', name: 'Basaveshwar Engineering College', location: 'Bagalkot' },
    { id: 'kvg', name: 'KVG College of Engineering', location: 'Sullia' },
    { id: 'stjoseph', name: "St. Joseph Engineering College", location: 'Mangalore' },
    { id: 'gcem', name: 'Global College of Engineering and Technology', location: 'Mysore' },
    { id: 'cmrit', name: 'CMR Institute of Technology', location: 'Bangalore' },
    { id: 'bnm', name: 'BNM Institute of Technology', location: 'Bangalore' },
    { id: 'mvjce', name: 'MVJ College of Engineering', location: 'Bangalore' },
    { id: 'ksit', name: 'KS Institute of Technology', location: 'Bangalore' },
    { id: 'ait', name: 'Acharya Institute of Technology', location: 'Bangalore' },
    { id: 'rnsit', name: 'RNS Institute of Technology', location: 'Bangalore' },
    { id: 'aceit', name: 'Atria College of Engineering and Technology', location: 'Bangalore' },
    { id: 'gsss', name: 'GSSS Institute of Engineering and Technology for Women', location: 'Mysore' },
];

// ─── Courses ─────────────────────────────────────────────────────────────────
export const College_COURSES: Course[] = [
    { id: 'cse', name: 'Computer Science and Engineering', shortName: 'CSE' },
    { id: 'aiml', name: 'Artificial Intelligence and Machine Learning', shortName: 'AIML' },
    { id: 'aids', name: 'Artificial Intelligence and Data Science', shortName: 'AIDS' },
    { id: 'cys', name: 'Computer Science and Engineering (Cyber Security)', shortName: 'CYS' },
    { id: 'ise', name: 'Information Science and Engineering', shortName: 'ISE' },
    { id: 'ece', name: 'Electronics and Communication Engineering', shortName: 'ECE' },
    { id: 'eee', name: 'Electrical and Electronics Engineering', shortName: 'EEE' },
    { id: 'me', name: 'Mechanical Engineering', shortName: 'ME' },
    { id: 'cv', name: 'Civil Engineering', shortName: 'CE' },
    { id: 'chemy', name: 'Chemical Engineering', shortName: 'CHE' },
    { id: 'iem', name: 'Industrial Engineering and Management', shortName: 'IEM' },
    { id: 'aero', name: 'Aeronautical Engineering', shortName: 'AERO' },
    { id: 'auto', name: 'Automobile Engineering', shortName: 'AUTO' },
    { id: 'bt', name: 'Biotechnology', shortName: 'BT' },
    { id: 'medx', name: 'Medical Electronics', shortName: 'MedE' },
    { id: 'et', name: 'Electronics and Telecommunication Engineering', shortName: 'E&T' },
];

// ─── Subjects per (course, semester) ─────────────────────────────────────────
// College CBCS 2021 Scheme
type SubjectMap = Record<string, Record<number, Subject[]>>;

export const College_SUBJECTS: SubjectMap = {
    // ── CSE ──────────────────────────────────────────────────────────────────
    cse: {
        1: [
            { code: '22MATCS11', name: 'Calculus and Linear Algebra' },
            { code: '22PCS12', name: 'Physics for Computer Science Engineering' },
            { code: '22ECS13', name: 'Elements of Computer Science and Engineering' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India and Cyber Law' },
            { code: '22SCP16', name: 'Self-Regulation and Programming Skills' },
        ],
        2: [
            { code: '22MATCS21', name: 'Advanced Calculus and Numerical Methods' },
            { code: '22CCS22', name: 'Chemistry for Computer Science' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22DSTL24', name: 'Discrete Mathematical Structures' },
            { code: '22UHV25', name: 'Universal Human Values' },
            { code: '22EGDS26', name: 'Engineering Drawing and Sketching' },
        ],
        3: [
            { code: '22MATCS31', name: 'Transform Calculus, Fourier Series & Numerical Techniques' },
            { code: '22CS32', name: 'Data Structures and Applications' },
            { code: '22CS33', name: 'Digital Design and Computer Organisation' },
            { code: '22CS34', name: 'Object Oriented Programming with Java' },
            { code: '22CS35A', name: 'Database Management System' },
            { code: '22CS36A', name: 'Computer Architecture' },
        ],
        4: [
            { code: '22CS41', name: 'Analysis and Design of Algorithms' },
            { code: '22CS42', name: 'Microcontrollers and Embedded Systems' },
            { code: '22CS43', name: 'Operating Systems' },
            { code: '22CS44', name: 'Software Engineering' },
            { code: '22CS45A', name: 'Computer Networks' },
            { code: '22CS46A', name: 'Theory of Computation' },
        ],
        5: [
            { code: '22CS51', name: 'Artificial Intelligence and Machine Learning' },
            { code: '22CS52', name: 'Computer Graphics and Visualization' },
            { code: '22CS53A', name: 'Web Technologies' },
            { code: '22CS54A', name: 'Cryptography and Network Security' },
            { code: '22CS55A', name: 'Cloud Computing' },
            { code: '22RMI56', name: 'Research Methods and IPR' },
        ],
        6: [
            { code: '22CS61', name: 'Compiler Design' },
            { code: '22CS62', name: 'Big Data Analytics' },
            { code: '22CS63A', name: 'Internet of Things' },
            { code: '22CS64A', name: 'Information and Network Security' },
            { code: '22CS65A', name: 'Linux Programming' },
            { code: '22CS66A', name: 'Language Processors' },
        ],
        7: [
            { code: '22CS71', name: 'Machine Learning Applications' },
            { code: '22CS72A', name: 'Blockchain Technology' },
            { code: '22CS73A', name: 'Deep Learning' },
            { code: '22MP741', name: 'Mini Project' },
            { code: '22CS74A', name: 'Augmented Reality and Virtual Reality' },
            { code: '22CS75A', name: 'Software Testing' },
        ],
        8: [
            { code: '22CIP81', name: 'Industry Elective I' },
            { code: '22CIP82', name: 'Open Elective II' },
            { code: '22CSP83', name: 'Project Work / Internship' },
            { code: '22CIP84', name: 'Seminar' },
        ],
    },

    // ── AIML ─────────────────────────────────────────────────────────────────
    aiml: {
        1: [
            { code: '22MATCS11', name: 'Calculus and Linear Algebra' },
            { code: '22PCS12', name: 'Physics for Computer Science Engineering' },
            { code: '22ECS13', name: 'Elements of Computer Science and Engineering' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India and Cyber Law' },
            { code: '22SCP16', name: 'Self-Regulation and Programming Skills' },
        ],
        2: [
            { code: '22MATCS21', name: 'Advanced Calculus and Numerical Methods' },
            { code: '22CCS22', name: 'Chemistry for Computer Science' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22DSTL24', name: 'Discrete Mathematical Structures' },
            { code: '22UHV25', name: 'Universal Human Values' },
            { code: '22EGDS26', name: 'Engineering Drawing and Sketching' },
        ],
        3: [
            { code: '22MATCS31', name: 'Transform Calculus & Numerical Techniques' },
            { code: '22AI32', name: 'Introduction to AI and ML' },
            { code: '22AI33', name: 'Data Structures and Algorithms' },
            { code: '22AI34', name: 'Python Programming for AI' },
            { code: '22AI35A', name: 'Database Systems' },
            { code: '22AI36A', name: 'Probability and Statistics for AI' },
        ],
        4: [
            { code: '22AI41', name: 'Machine Learning Techniques' },
            { code: '22AI42', name: 'Deep Learning' },
            { code: '22AI43', name: 'Computer Vision' },
            { code: '22AI44', name: 'Natural Language Processing' },
            { code: '22AI45A', name: 'Big Data Analytics' },
            { code: '22AI46A', name: 'Reinforcement Learning' },
        ],
        5: [
            { code: '22AI51', name: 'Applied Machine Learning' },
            { code: '22AI52', name: 'AI for IoT' },
            { code: '22AI53A', name: 'Cloud Computing for AI' },
            { code: '22AI54A', name: 'Ethics in AI' },
            { code: '22AI55A', name: 'AI Applications in Healthcare' },
            { code: '22RMI56', name: 'Research Methods and IPR' },
        ],
        6: [
            { code: '22AI61', name: 'Generative AI' },
            { code: '22AI62', name: 'MLOps and Deployment' },
            { code: '22AI63A', name: 'Explainable AI' },
            { code: '22AI64A', name: 'Data Engineering' },
            { code: '22AI65A', name: 'AI for Robotics' },
        ],
        7: [
            { code: '22AI71', name: 'Advanced Deep Learning' },
            { code: '22AI72A', name: 'Large Language Models' },
            { code: '22AI73A', name: 'AI Project Management' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22IP81', name: 'Industry Elective' },
            { code: '22AI83', name: 'Project Work / Internship' },
            { code: '22AI84', name: 'Seminar' },
        ],
    },

    // ── ECE ──────────────────────────────────────────────────────────────────
    ece: {
        1: [
            { code: '22MATME11', name: 'Calculus and Differential Equations' },
            { code: '22PEE12', name: 'Engineering Physics' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India' },
            { code: '22EGWS16', name: 'Workshop Practice' },
            { code: '22SCP16', name: 'Problem Solving and Programming' },
        ],
        2: [
            { code: '22MATEC21', name: 'Advanced Mathematics for ECE' },
            { code: '22CCE22', name: 'Chemistry for Electronics' },
            { code: '22BEL23', name: 'Basic Electronics Engineering' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22UHV25', name: 'Universal Human Values' },
            { code: '22EGDS26', name: 'Engineering Drawing and Sketching' },
        ],
        3: [
            { code: '22MATEC31', name: 'Transform Calculus & Vector Calculus' },
            { code: '22EC32', name: 'Analog Circuits' },
            { code: '22EC33', name: 'Logic Design' },
            { code: '22EC34', name: 'Network Theory' },
            { code: '22EC35A', name: 'Data Structures' },
            { code: '22EC36A', name: 'Electronic Devices' },
        ],
        4: [
            { code: '22EC41', name: 'Signals and Systems' },
            { code: '22EC42', name: 'Electromagnetic Waves' },
            { code: '22EC43', name: 'Digital Communication' },
            { code: '22EC44', name: 'Control Systems' },
            { code: '22EC45A', name: 'VLSI Design' },
            { code: '22EC46A', name: 'Microcontrollers' },
        ],
        5: [
            { code: '22EC51', name: 'Digital Signal Processing' },
            { code: '22EC52', name: 'Antenna and Propagation' },
            { code: '22EC53A', name: 'Wireless Communication' },
            { code: '22EC54A', name: 'MEMS Technology' },
            { code: '22RMI56', name: 'Research Methods and IPR' },
        ],
        6: [
            { code: '22EC61', name: 'Embedded Systems' },
            { code: '22EC62', name: 'Optical Fiber Communication' },
            { code: '22EC63A', name: 'Image Processing' },
            { code: '22EC64A', name: 'RF and Microwave Engineering' },
        ],
        7: [
            { code: '22EC71', name: 'Advanced Communication Systems' },
            { code: '22EC72A', name: 'Machine Learning for ECE' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22ECE81', name: 'Industry Elective' },
            { code: '22ECE83', name: 'Project Work / Internship' },
        ],
    },

    // ── EEE ──────────────────────────────────────────────────────────────────
    eee: {
        1: [
            { code: '22MATME11', name: 'Calculus and Differential Equations' },
            { code: '22PEE12', name: 'Engineering Physics' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India' },
            { code: '22EGWS16', name: 'Workshop Practice' },
        ],
        2: [
            { code: '22MATEE21', name: 'Advanced Mathematics for EEE' },
            { code: '22CCE22', name: 'Engineering Chemistry' },
            { code: '22BEL23', name: 'Basic Electronics Engineering' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22UHV25', name: 'Universal Human Values' },
        ],
        3: [
            { code: '22MATEE31', name: 'Transform Calculus & Numerical Methods' },
            { code: '22EE32', name: 'DC Machines and Transformers' },
            { code: '22EE33', name: 'Electric Circuit Analysis' },
            { code: '22EE34', name: 'Electromagnetic Field Theory' },
            { code: '22EE35A', name: 'Analog Electronics' },
            { code: '22EE36A', name: 'Measurement and Instrumentation' },
        ],
        4: [
            { code: '22EE41', name: 'AC Machines' },
            { code: '22EE42', name: 'Power Electronics' },
            { code: '22EE43', name: 'Control Systems' },
            { code: '22EE44', name: 'Signals and Systems' },
            { code: '22EE45A', name: 'Digital Electronics' },
        ],
        5: [
            { code: '22EE51', name: 'Power Systems I' },
            { code: '22EE52', name: 'Electrical Machines III' },
            { code: '22EE53A', name: 'Industrial Drives' },
            { code: '22EE54A', name: 'Digital Signal Processing' },
        ],
        6: [
            { code: '22EE61', name: 'Power Systems II' },
            { code: '22EE62', name: 'Switchgear and Protection' },
            { code: '22EE63A', name: 'FACTS and HVDC' },
        ],
        7: [
            { code: '22EE71', name: 'AI Applications in Power Systems' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22EEE81', name: 'Industry Elective' },
            { code: '22EEE83', name: 'Project Work / Internship' },
        ],
    },

    // ── ME ───────────────────────────────────────────────────────────────────
    me: {
        1: [
            { code: '22MATME11', name: 'Calculus and Differential Equations' },
            { code: '22PME12', name: 'Engineering Physics' },
            { code: '22EM13', name: 'Engineering Mechanics' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India' },
            { code: '22WS16', name: 'Workshop Practice' },
        ],
        2: [
            { code: '22MATME21', name: 'Advanced Mathematics for Mechanical' },
            { code: '22CME22', name: 'Engineering Chemistry' },
            { code: '22ME23', name: 'Elements of Mechanical Engineering' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22UHV25', name: 'Universal Human Values' },
        ],
        3: [
            { code: '22MATME31', name: 'Transform Calculus & Numerical Methods' },
            { code: '22ME32', name: 'Materials Science' },
            { code: '22ME33', name: 'Fluid Mechanics' },
            { code: '22ME34', name: 'Basic Thermodynamics' },
            { code: '22ME35A', name: 'Manufacturing Process-I' },
            { code: '22ME36A', name: 'Strength of Materials' },
        ],
        4: [
            { code: '22ME41', name: 'Applied Thermodynamics' },
            { code: '22ME42', name: 'Kinematics of Machines' },
            { code: '22ME43', name: 'Metal Casting and Joining' },
            { code: '22ME44', name: 'Heat Transfer' },
            { code: '22ME45A', name: 'Dynamics of Machines' },
        ],
        5: [
            { code: '22ME51', name: 'Finite Element Methods' },
            { code: '22ME52', name: 'CNC Technology' },
            { code: '22ME53A', name: 'Refrigeration and Air Conditioning' },
            { code: '22ME54A', name: 'Mechatronics' },
        ],
        6: [
            { code: '22ME61', name: 'Design of Machine Elements' },
            { code: '22ME62', name: 'Automobile Engineering' },
            { code: '22ME63A', name: 'Robotics' },
        ],
        7: [
            { code: '22ME71', name: 'Industrial Management' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22ME81', name: 'Industry Elective' },
            { code: '22ME83', name: 'Project Work / Internship' },
        ],
    },

    // ── ISE ──────────────────────────────────────────────────────────────────
    ise: {
        1: [
            { code: '22MATCS11', name: 'Calculus and Linear Algebra' },
            { code: '22PCS12', name: 'Physics for Computer Science' },
            { code: '22ECS13', name: 'Elements of Computer Science' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India and Cyber Law' },
        ],
        2: [
            { code: '22MATCS21', name: 'Advanced Calculus and Numerical Methods' },
            { code: '22CCS22', name: 'Chemistry for Computer Science' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22DSTL24', name: 'Discrete Mathematical Structures' },
            { code: '22UHV25', name: 'Universal Human Values' },
        ],
        3: [
            { code: '22MATCS31', name: 'Transform Calculus & Numerical Techniques' },
            { code: '22IS32', name: 'Data Structures and Applications' },
            { code: '22IS33', name: 'Digital Design and Computer Organisation' },
            { code: '22IS34', name: 'OOP with Java' },
            { code: '22IS35A', name: 'Database Management System' },
        ],
        4: [
            { code: '22IS41', name: 'Analysis and Design of Algorithms' },
            { code: '22IS42', name: 'Microcontrollers and Embedded Systems' },
            { code: '22IS43', name: 'Operating Systems' },
            { code: '22IS44', name: 'Software Engineering' },
            { code: '22IS45A', name: 'Computer Networks' },
        ],
        5: [
            { code: '22IS51', name: 'Machine Learning' },
            { code: '22IS52', name: 'Web Technologies and Applications' },
            { code: '22IS53A', name: 'Information Security' },
            { code: '22IS54A', name: 'Big Data Analytics' },
        ],
        6: [
            { code: '22IS61', name: 'Cloud Computing' },
            { code: '22IS62', name: 'Service Oriented Architecture' },
            { code: '22IS63A', name: 'Digital Forensics' },
        ],
        7: [
            { code: '22IS71', name: 'AI and Intelligent Systems' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22IS81', name: 'Industry Elective' },
            { code: '22IS83', name: 'Project Work / Internship' },
        ],
    },

    // ── Civil ─────────────────────────────────────────────────────────────────
    cv: {
        1: [
            { code: '22MATME11', name: 'Calculus and Differential Equations' },
            { code: '22PCE12', name: 'Engineering Physics' },
            { code: '22EM13', name: 'Engineering Mechanics' },
            { code: '22EGH14', name: 'Engineering Graphics' },
            { code: '22CIC15', name: 'Constitution of India' },
        ],
        2: [
            { code: '22MATCV21', name: 'Advanced Mathematics for Civil' },
            { code: '22CCE22', name: 'Engineering Chemistry' },
            { code: '22BCE23', name: 'Basic Civil Engineering' },
            { code: '22CPL23', name: 'Programming in C' },
            { code: '22UHV25', name: 'Universal Human Values' },
        ],
        3: [
            { code: '22MATCV31', name: 'Transform Calculus & Statistics' },
            { code: '22CV32', name: 'Building Materials and Construction' },
            { code: '22CV33', name: 'Surveying' },
            { code: '22CV34', name: 'Mechanics of Materials' },
            { code: '22CV35A', name: 'Fluid Mechanics' },
        ],
        4: [
            { code: '22CV41', name: 'Structural Analysis I' },
            { code: '22CV42', name: 'Concrete Technology' },
            { code: '22CV43', name: 'Soil Mechanics' },
            { code: '22CV44', name: 'Transportation Engineering I' },
        ],
        5: [
            { code: '22CV51', name: 'Structural Analysis II' },
            { code: '22CV52', name: 'Design of RCC Structures' },
            { code: '22CV53A', name: 'Foundation Engineering' },
            { code: '22CV54A', name: 'Environmental Engineering' },
        ],
        6: [
            { code: '22CV61', name: 'Design of Steel Structures' },
            { code: '22CV62', name: 'Irrigation Engineering' },
            { code: '22CV63A', name: 'GIS and Remote Sensing' },
        ],
        7: [
            { code: '22CV71', name: 'Construction Management' },
            { code: '22MP741', name: 'Mini Project' },
        ],
        8: [
            { code: '22CV81', name: 'Industry Elective' },
            { code: '22CV83', name: 'Project Work / Internship' },
        ],
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getSubjects(courseId: string, year: number): Subject[] {
    const courseData = College_SUBJECTS[courseId];
    if (!courseData) return [];
    
    // Combine subjects for both semesters in the given year
    const s1 = courseData[year * 2 - 1] || [];
    const s2 = courseData[year * 2] || [];
    return [...s1, ...s2];
}

export interface SubjectWithContext extends Subject {
    courseId: string;
    courseShort: string;
    semester: number;
    isCustom?: boolean;
}

const CUSTOM_SUBJECTS_KEY = 'moduly_custom_subjects';

function loadCustomSubjects(): SubjectWithContext[] {
    try {
        const raw = localStorage.getItem(CUSTOM_SUBJECTS_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as SubjectWithContext[];
    } catch {
        return [];
    }
}

function saveCustomSubjects(subjects: SubjectWithContext[]): void {
    localStorage.setItem(CUSTOM_SUBJECTS_KEY, JSON.stringify(subjects));
}

export function addCustomSubject(name: string, code: string): SubjectWithContext {
    const customs = loadCustomSubjects();
    const entry: SubjectWithContext = {
        code,
        name,
        courseId: 'custom',
        courseShort: 'Custom',
        semester: 0,
        isCustom: true,
    };
    // Avoid duplicates by code
    if (!customs.some(s => s.code === code)) {
        customs.push(entry);
        saveCustomSubjects(customs);
    }
    return entry;
}

export function getAllSubjects(): SubjectWithContext[] {
    const seen = new Set<string>();
    const results: SubjectWithContext[] = [];

    for (const courseEntry of College_COURSES) {
        const courseData = College_SUBJECTS[courseEntry.id];
        if (!courseData) continue;
        for (const [semStr, subjects] of Object.entries(courseData)) {
            const sem = Number(semStr);
            for (const sub of subjects) {
                if (!seen.has(sub.code)) {
                    seen.add(sub.code);
                    results.push({
                        ...sub,
                        courseId: courseEntry.id,
                        courseShort: courseEntry.shortName,
                        semester: sem,
                    });
                }
            }
        }
    }

    // Merge custom subjects from localStorage
    for (const custom of loadCustomSubjects()) {
        if (!seen.has(custom.code)) {
            seen.add(custom.code);
            results.push(custom);
        }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
}

export function getCourse(courseId: string): Course | undefined {
    return College_COURSES.find(c => c.id === courseId);
}

export function getCollege(collegeId: string): College | undefined {
    return College_COLLEGES.find(c => c.id === collegeId);
}
