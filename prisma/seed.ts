/**
 * Database seed.
 *
 * Idempotent: every write is an upsert keyed on a natural unique column, so
 * running it repeatedly converges rather than duplicating. Reference data
 * (roles, all 38 Kosovo municipalities, categories, badges) is always seeded;
 * demo accounts and sample reports are added only when SEED_DEMO=true, so this
 * script is safe to run against production.
 */
import { PrismaClient, type Prisma, type ReportStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_DEMO = process.env.SEED_DEMO === "true";
const BCRYPT_ROUNDS = 12;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/ë/g, "e")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const ROLES = [
  { name: "CITIZEN" as const, label: "Qytetar", description: "Mund të raportojë, votojë dhe komentojë." },
  {
    name: "MUNICIPALITY_EMPLOYEE" as const,
    label: "Punonjës komunal",
    description: "Menaxhon raportet e komunës së vet.",
  },
  {
    name: "MUNICIPALITY_ADMIN" as const,
    label: "Administrator komunal",
    description: "Menaxhon raportet dhe stafin e komunës së vet.",
  },
  { name: "ADMIN" as const, label: "Administrator", description: "Qasje e plotë në platformë." },
];

/** All 38 municipalities of Kosovo, with administrative centres. */
const MUNICIPALITIES = [
  { name: "Prishtinë", region: "Prishtinë", population: 227166, latitude: 42.6629, longitude: 21.1655, zoom: 13 },
  { name: "Prizren", region: "Prizren", population: 177781, latitude: 42.2139, longitude: 20.7397, zoom: 13 },
  { name: "Ferizaj", region: "Ferizaj", population: 108610, latitude: 42.3703, longitude: 21.1553, zoom: 13 },
  { name: "Pejë", region: "Pejë", population: 96450, latitude: 42.6593, longitude: 20.2887, zoom: 13 },
  { name: "Gjakovë", region: "Gjakovë", population: 94556, latitude: 42.3803, longitude: 20.4308, zoom: 13 },
  { name: "Gjilan", region: "Gjilan", population: 90178, latitude: 42.4637, longitude: 21.4694, zoom: 13 },
  { name: "Mitrovicë", region: "Mitrovicë", population: 71909, latitude: 42.8914, longitude: 20.8660, zoom: 13 },
  { name: "Podujevë", region: "Prishtinë", population: 88499, latitude: 42.9111, longitude: 21.1933, zoom: 13 },
  { name: "Vushtrri", region: "Mitrovicë", population: 69870, latitude: 42.8231, longitude: 20.9675, zoom: 13 },
  { name: "Suharekë", region: "Prizren", population: 59722, latitude: 42.3586, longitude: 20.8256, zoom: 13 },
  { name: "Rahovec", region: "Gjakovë", population: 56208, latitude: 42.3994, longitude: 20.6547, zoom: 13 },
  { name: "Drenas", region: "Prishtinë", population: 58531, latitude: 42.6256, longitude: 20.8931, zoom: 13 },
  { name: "Lipjan", region: "Prishtinë", population: 57605, latitude: 42.5217, longitude: 21.1258, zoom: 13 },
  { name: "Malishevë", region: "Prizren", population: 54613, latitude: 42.4822, longitude: 20.7458, zoom: 13 },
  { name: "Kamenicë", region: "Gjilan", population: 36085, latitude: 42.5781, longitude: 21.5764, zoom: 13 },
  { name: "Viti", region: "Gjilan", population: 46987, latitude: 42.3222, longitude: 21.3583, zoom: 13 },
  { name: "Deçan", region: "Pejë", population: 40019, latitude: 42.5406, longitude: 20.2886, zoom: 13 },
  { name: "Istog", region: "Pejë", population: 39289, latitude: 42.7806, longitude: 20.4856, zoom: 13 },
  { name: "Klinë", region: "Pejë", population: 38496, latitude: 42.6206, longitude: 20.5772, zoom: 13 },
  { name: "Skenderaj", region: "Mitrovicë", population: 50858, latitude: 42.7469, longitude: 20.7889, zoom: 13 },
  { name: "Dragash", region: "Prizren", population: 33997, latitude: 42.0619, longitude: 20.6531, zoom: 13 },
  { name: "Fushë Kosovë", region: "Prishtinë", population: 34827, latitude: 42.6383, longitude: 21.0906, zoom: 14 },
  { name: "Kaçanik", region: "Ferizaj", population: 33409, latitude: 42.2317, longitude: 21.2597, zoom: 13 },
  { name: "Obiliq", region: "Prishtinë", population: 21549, latitude: 42.6867, longitude: 21.0714, zoom: 14 },
  { name: "Shtime", region: "Ferizaj", population: 27324, latitude: 42.4331, longitude: 21.0397, zoom: 14 },
  { name: "Leposaviq", region: "Mitrovicë", population: 18600, latitude: 43.1017, longitude: 20.8028, zoom: 13 },
  { name: "Zubin Potok", region: "Mitrovicë", population: 6616, latitude: 42.9147, longitude: 20.6906, zoom: 13 },
  { name: "Zveçan", region: "Mitrovicë", population: 16650, latitude: 42.9075, longitude: 20.8408, zoom: 14 },
  { name: "Novobërdë", region: "Prishtinë", population: 6729, latitude: 42.6008, longitude: 21.4342, zoom: 13 },
  { name: "Shtërpcë", region: "Ferizaj", population: 6949, latitude: 42.2394, longitude: 21.0269, zoom: 13 },
  { name: "Junik", region: "Gjakovë", population: 6084, latitude: 42.4761, longitude: 20.2775, zoom: 14 },
  { name: "Mamushë", region: "Prizren", population: 5507, latitude: 42.3239, longitude: 20.7264, zoom: 14 },
  { name: "Hani i Elezit", region: "Ferizaj", population: 9403, latitude: 42.1508, longitude: 21.2969, zoom: 14 },
  { name: "Graçanicë", region: "Prishtinë", population: 10675, latitude: 42.5992, longitude: 21.1936, zoom: 14 },
  { name: "Ranillug", region: "Gjilan", population: 3866, latitude: 42.5192, longitude: 21.5544, zoom: 14 },
  { name: "Partesh", region: "Gjilan", population: 1787, latitude: 42.4014, longitude: 21.4283, zoom: 14 },
  { name: "Kllokot", region: "Gjilan", population: 2556, latitude: 42.3708, longitude: 21.3792, zoom: 14 },
  { name: "Mitrovicë e Veriut", region: "Mitrovicë", population: 12326, latitude: 42.9008, longitude: 20.8683, zoom: 14 },
];

const CATEGORIES = [
  {
    name: "Rrugë të dëmtuara",
    description: "Gropa, asfalt i shkatërruar, trotuare të prishura.",
    icon: "construction",
    color: "#dc2626",
    sortOrder: 1,
  },
  {
    name: "Mbeturina",
    description: "Kontejnerë të mbushur, mbeturina të pagrumbulluara.",
    icon: "trash-2",
    color: "#16a34a",
    sortOrder: 2,
  },
  {
    name: "Ndriçim publik",
    description: "Llamba të prishura ose shtylla ndriçimi jashtë funksionit.",
    icon: "lightbulb",
    color: "#f59e0b",
    sortOrder: 3,
  },
  {
    name: "Rrjedhje uji",
    description: "Gypa të plasur, rrjedhje uji, probleme me kanalizimin.",
    icon: "droplets",
    color: "#0ea5e9",
    sortOrder: 4,
  },
  {
    name: "Hedhje ilegale",
    description: "Deponi ilegale dhe hedhje mbeturinash jashtë vendeve të lejuara.",
    icon: "trash",
    color: "#7c3aed",
    sortOrder: 5,
  },
  {
    name: "Prona publike",
    description: "Stola, parqe, shatërvane dhe lodra të dëmtuara.",
    icon: "landmark",
    color: "#0891b2",
    sortOrder: 6,
  },
  {
    name: "Siguri në trafik",
    description: "Semaforë të prishur, sinjalistikë që mungon, vija të fshira.",
    icon: "traffic-cone",
    color: "#ea580c",
    sortOrder: 7,
  },
  {
    name: "Gjelbërim",
    description: "Pemë të rrezikshme, bar i parregulluar, hapësira të gjelbra.",
    icon: "trees",
    color: "#15803d",
    sortOrder: 8,
  },
];

const BADGES = [
  { slug: "raportuesi-i-pare", name: "Raportuesi i parë", description: "Publikuat raportin tuaj të parë.", kind: "REPORTS", threshold: 1, icon: "flag", color: "#2563eb" },
  { slug: "raportues-aktiv", name: "Raportues aktiv", description: "10 raporte të publikuara.", kind: "REPORTS", threshold: 10, icon: "flame", color: "#ea580c" },
  { slug: "roje-e-qytetit", name: "Roje e qytetit", description: "50 raporte të publikuara.", kind: "REPORTS", threshold: 50, icon: "shield", color: "#7c3aed" },
  { slug: "zeri-i-komunitetit", name: "Zëri i komunitetit", description: "100 vota të marra në raportet tuaja.", kind: "VOTES", threshold: 100, icon: "megaphone", color: "#0891b2" },
  { slug: "ndikues", name: "Ndikues", description: "500 vota të marra në raportet tuaja.", kind: "VOTES", threshold: 500, icon: "trending-up", color: "#c026d3" },
  { slug: "zgjidhes-problemesh", name: "Zgjidhës problemesh", description: "5 nga raportet tuaja u zgjidhën.", kind: "RESOLVED", threshold: 5, icon: "check-circle", color: "#059669" },
  { slug: "diskutues", name: "Diskutues", description: "25 komente konstruktive.", kind: "COMMENTS", threshold: 25, icon: "message-circle", color: "#f59e0b" },
];

// ---------------------------------------------------------------------------
// Demo content (SEED_DEMO=true only)
// ---------------------------------------------------------------------------

const DEMO_REPORTS: {
  title: string;
  description: string;
  categorySlug: string;
  municipalitySlug: string;
  latitude: number;
  longitude: number;
  address: string;
  status: ReportStatus;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}[] = [
  {
    title: "Gropë e thellë në rrugën 'Nëna Terezë' pranë sheshit",
    description:
      "Në mes të rrugës, afër hyrjes së sheshit, ka një gropë rreth 40cm të thellë. Automjetet e shmangin duke dalë në korsinë tjetër, gjë që ka shkaktuar disa situata të rrezikshme. Problemi ekziston prej rreth dy muajsh dhe është përkeqësuar pas shirave të fundit.",
    categorySlug: "rruge-te-demtuara",
    municipalitySlug: "prishtine",
    latitude: 42.6635,
    longitude: 21.1621,
    address: "Rruga Nëna Terezë, afër sheshit Skënderbeu",
    status: "IN_PROGRESS",
    priority: "HIGH",
  },
  {
    title: "Trotuari te stacioni i autobusit është plotësisht i shkatërruar",
    description:
      "Pllakat e trotuarit para stacionit kryesor të autobusit janë ngritur dhe të thyera në një sipërfaqe të gjerë. Në orët e pikut aty presin dhjetëra udhëtarë dhe disa prej tyre janë penguar. Situata përkeqësohet kur bie shi, sepse gropat mbushen me ujë dhe nuk duken.",
    categorySlug: "rruge-te-demtuara",
    municipalitySlug: "prishtine",
    latitude: 42.6601,
    longitude: 21.1589,
    address: "Stacioni kryesor i autobusit, hyrja jugore",
    status: "PENDING",
    priority: "HIGH",
  },
  {
    title: "Kontejnerët nuk zbrazen prej një jave në lagjen Dardania",
    description:
      "Kontejnerët te blloku 4 janë tejmbushur dhe mbeturinat kanë dalë përreth. Era e rëndë ndihet deri te hyrjet e banesave dhe janë shfaqur minj. Kërkojmë zbrazje urgjente dhe një orar të rregullt grumbullimi.",
    categorySlug: "mbeturina",
    municipalitySlug: "prishtine",
    latitude: 42.6489,
    longitude: 21.1497,
    address: "Lagjja Dardania, blloku 4",
    status: "COMPLETED",
    priority: "MEDIUM",
  },
  {
    title: "Ndriçimi publik nuk funksionon në rrugicën te kalaja",
    description:
      "Të gjitha llambat në rrugicën që të çon drejt kalasë janë të fikura prej rreth tre javësh. Rruga është krejtësisht e errët pas orës 19:00, gjë që i shqetëson banorët dhe turistët që kthehen nga kalaja.",
    categorySlug: "ndricim-publik",
    municipalitySlug: "prizren",
    latitude: 42.2103,
    longitude: 20.7411,
    address: "Rrugica drejt Kalasë së Prizrenit",
    status: "ASSIGNED",
    priority: "HIGH",
  },
  {
    title: "Rrjedhje e madhe uji në trotuarin te tregu",
    description:
      "Nga një gyp nën trotuar po del ujë vazhdimisht prej disa ditësh. Uji ka krijuar një pellg të përhershëm dhe kalimtarët detyrohen të dalin në rrugë. Gjatë natës uji ngrin dhe bëhet i rrezikshëm.",
    categorySlug: "rrjedhje-uji",
    municipalitySlug: "ferizaj",
    latitude: 42.3711,
    longitude: 21.1547,
    address: "Trotuari përballë tregut të gjelbër",
    status: "VERIFIED",
    priority: "HIGH",
  },
  {
    title: "Deponi ilegale te dalja e fshatit",
    description:
      "Prej muajsh dikush po hedh mbeturina ndërtimi dhe mbeturina shtëpiake në një parcelë pranë rrugës kryesore. Sasia po rritet çdo javë. Kërkojmë pastrim dhe vendosje të sinjalistikës ndaluese.",
    categorySlug: "hedhje-ilegale",
    municipalitySlug: "peje",
    latitude: 42.6551,
    longitude: 20.2932,
    address: "Dalja veriore e qytetit, pranë rrugës rajonale",
    status: "PENDING",
    priority: "MEDIUM",
  },
  {
    title: "Lodrat në parkun e fëmijëve janë të dëmtuara",
    description:
      "Dy rrëshqitëse kanë skaje metalike të zbuluara dhe një lëkundëse është shkëputur nga baza. Parku përdoret çdo ditë nga fëmijë të vegjël dhe ekziston rrezik lëndimi.",
    categorySlug: "prona-publike",
    municipalitySlug: "gjilan",
    latitude: 42.4629,
    longitude: 21.4711,
    address: "Parku i qytetit, zona e lodrave",
    status: "VERIFIED",
    priority: "CRITICAL",
  },
  {
    title: "Semafori te kryqëzimi kryesor nuk punon",
    description:
      "Semafori është jashtë funksionit prej katër ditësh. Kryqëzimi është shumë i ngarkuar në orët e pikut dhe automjetet kalojnë pa rregull. Është një çështje serioze sigurie.",
    categorySlug: "siguri-ne-trafik",
    municipalitySlug: "gjakove",
    latitude: 42.3821,
    longitude: 20.4297,
    address: "Kryqëzimi qendror",
    status: "IN_PROGRESS",
    priority: "CRITICAL",
  },
  {
    title: "Pemë e rrezikshme mbi trotuar pas stuhisë",
    description:
      "Një degë e madhe është thyer pjesërisht dhe rri e varur mbi trotuar. Me erën e parë të fortë mund të bjerë mbi kalimtarë. Do të duhej prerë sa më parë.",
    categorySlug: "gjelberim",
    municipalitySlug: "mitrovice",
    latitude: 42.8901,
    longitude: 20.8677,
    address: "Bulevardi kryesor, afër shkollës fillore",
    status: "PENDING",
    priority: "HIGH",
  },
  {
    title: "Trotuari i shkatërruar e bën të pamundur kalimin me karrocë",
    description:
      "Pllakat e trotuarit janë ngritur dhe thyer në një gjatësi prej rreth 30 metrash. Personat me karroca dhe prindërit me karroca fëmijësh detyrohen të ecin në rrugë. Kërkojmë rregullim me qasje universale.",
    categorySlug: "rruge-te-demtuara",
    municipalitySlug: "podujeve",
    latitude: 42.9103,
    longitude: 21.1921,
    address: "Rruga kryesore, para qendrës së mjekësisë familjare",
    status: "PENDING",
    priority: "MEDIUM",
  },
  {
    title: "Ujërat e zeza dalin në rrugë pas çdo shiu",
    description:
      "Sistemi i kanalizimit nuk e përballon sasinë e ujit dhe pas çdo shiu ujërat e zeza dalin në sipërfaqe. Era është e padurueshme dhe ka rrezik higjienik për fëmijët që luajnë aty pranë.",
    categorySlug: "rrjedhje-uji",
    municipalitySlug: "vushtrri",
    latitude: 42.8241,
    longitude: 20.9662,
    address: "Rruga e fshatit, pranë xhamisë",
    status: "ASSIGNED",
    priority: "HIGH",
  },
  {
    title: "Stolat e parkut janë të thyer dhe të pandriçuar",
    description:
      "Nga tetë stola, pesë janë me dërrasa të thyera. Gjithashtu ndriçimi i shtegut është i dobët, prandaj parku braktiset pas perëndimit të diellit.",
    categorySlug: "prona-publike",
    municipalitySlug: "suhareke",
    latitude: 42.3591,
    longitude: 20.8264,
    address: "Parku qendror",
    status: "REJECTED",
    priority: "LOW",
  },
  {
    title: "Grumbullim mbeturinash pranë shkollës fillore",
    description:
      "Prapa shkollës është krijuar një grumbull mbeturinash që nxënësit e kalojnë çdo ditë. Përveç pastrimit, do të ndihmonte edhe vendosja e një kontejneri të mbyllur.",
    categorySlug: "mbeturina",
    municipalitySlug: "lipjan",
    latitude: 42.5223,
    longitude: 21.1265,
    address: "Prapa shkollës fillore",
    status: "COMPLETED",
    priority: "MEDIUM",
  },
];

// ---------------------------------------------------------------------------

async function seedReferenceData() {
  console.log("→ Rolet…");
  for (const role of ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { label: role.label, description: role.description },
      create: role,
    });
  }

  console.log(`→ Komunat (${MUNICIPALITIES.length})…`);
  for (const municipality of MUNICIPALITIES) {
    const slug = slugify(municipality.name);
    await prisma.municipality.upsert({
      where: { slug },
      update: {
        name: municipality.name,
        region: municipality.region,
        population: municipality.population,
        latitude: municipality.latitude,
        longitude: municipality.longitude,
        zoom: municipality.zoom,
      },
      create: { ...municipality, slug },
    });
  }

  console.log(`→ Kategoritë (${CATEGORIES.length})…`);
  for (const category of CATEGORIES) {
    const slug = slugify(category.name);
    await prisma.category.upsert({
      where: { slug },
      update: { ...category },
      create: { ...category, slug },
    });
  }

  console.log(`→ Distinktivët (${BADGES.length})…`);
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { slug: badge.slug },
      update: badge,
      create: badge,
    });
  }
}

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.log(
      "→ Administratori u anashkalua (vendosni SEED_ADMIN_EMAIL dhe SEED_ADMIN_PASSWORD)."
    );
    return;
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: "ADMIN" } });
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { roleId: adminRole.id, passwordHash },
    create: {
      email: email.toLowerCase(),
      name: "Administrator",
      username: "admin",
      passwordHash,
      roleId: adminRole.id,
      emailVerified: new Date(),
      profile: { create: { bio: "Administrator i platformës." } },
    },
  });

  console.log(`→ Administratori u krijua: ${email}`);
}

async function seedDemoUsers() {
  const [citizenRole, employeeRole, municipalAdminRole] = await Promise.all([
    prisma.role.findUniqueOrThrow({ where: { name: "CITIZEN" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "MUNICIPALITY_EMPLOYEE" } }),
    prisma.role.findUniqueOrThrow({ where: { name: "MUNICIPALITY_ADMIN" } }),
  ]);

  const prishtina = await prisma.municipality.findUniqueOrThrow({ where: { slug: "prishtine" } });
  const prizren = await prisma.municipality.findUniqueOrThrow({ where: { slug: "prizren" } });

  // Shared demo password — documented in the README as demo-only.
  const passwordHash = await bcrypt.hash("Demo1234", BCRYPT_ROUNDS);

  const people: Prisma.UserCreateInput[] = [
    {
      email: "arta@shembull.com",
      name: "Arta Krasniqi",
      username: "arta",
      passwordHash,
      role: { connect: { id: citizenRole.id } },
      municipality: { connect: { id: prishtina.id } },
      profile: { create: { bio: "Banore e Prishtinës. Më intereson infrastruktura urbane.", city: "Prishtinë" } },
    },
    {
      email: "burim@shembull.com",
      name: "Burim Gashi",
      username: "burim",
      passwordHash,
      role: { connect: { id: citizenRole.id } },
      municipality: { connect: { id: prizren.id } },
      profile: { create: { bio: "Aktivist qytetar në Prizren.", city: "Prizren" } },
    },
    {
      email: "drilon@shembull.com",
      name: "Drilon Berisha",
      username: "drilon",
      passwordHash,
      role: { connect: { id: citizenRole.id } },
      municipality: { connect: { id: prishtina.id } },
      profile: { create: { city: "Prishtinë" } },
    },
    {
      email: "punonjes@prishtina.shembull.com",
      name: "Fatlum Rexhepi",
      username: "fatlum_pr",
      passwordHash,
      role: { connect: { id: employeeRole.id } },
      municipality: { connect: { id: prishtina.id } },
      profile: { create: { bio: "Sektori i infrastrukturës, Komuna e Prishtinës." } },
    },
    {
      email: "admin@prishtina.shembull.com",
      name: "Vjosa Hoxha",
      username: "vjosa_pr",
      passwordHash,
      role: { connect: { id: municipalAdminRole.id } },
      municipality: { connect: { id: prishtina.id } },
      profile: { create: { bio: "Koordinatore e shërbimeve publike." } },
    },
  ];

  const users = [];
  for (const person of people) {
    users.push(
      await prisma.user.upsert({
        where: { email: person.email },
        update: {},
        create: person,
      })
    );
  }

  console.log(`→ ${users.length} llogari demo.`);
  return users;
}

/** Realistic note for each status, mirroring what a municipality would write. */
const STATUS_NOTES: Record<ReportStatus, string> = {
  PENDING: "Raporti u krijua.",
  VERIFIED: "Problemi u konfirmua nga ekipi i terrenit.",
  ASSIGNED: "Raporti iu caktua ekipit përgjegjës.",
  IN_PROGRESS: "Punimet kanë filluar.",
  COMPLETED: "Puna u krye dhe u verifikua në terren.",
  REJECTED: "Rasti nuk bie nën kompetencën e kësaj komune.",
  DUPLICATE: "Problemi është raportuar më parë.",
};

/**
 * The intermediate statuses a report passes through to reach `target`,
 * expressed as from/to pairs starting at PENDING.
 */
function buildStatusChain(target: ReportStatus): { from: ReportStatus; to: ReportStatus }[] {
  const paths: Record<ReportStatus, ReportStatus[]> = {
    PENDING: [],
    VERIFIED: ["VERIFIED"],
    ASSIGNED: ["VERIFIED", "ASSIGNED"],
    IN_PROGRESS: ["VERIFIED", "ASSIGNED", "IN_PROGRESS"],
    COMPLETED: ["VERIFIED", "ASSIGNED", "IN_PROGRESS", "COMPLETED"],
    REJECTED: ["REJECTED"],
    DUPLICATE: ["DUPLICATE"],
  };

  const steps = paths[target];
  let previous: ReportStatus = "PENDING";
  return steps.map((to) => {
    const pair = { from: previous, to };
    previous = to;
    return pair;
  });
}

async function seedDemoReports(authors: { id: string }[]) {
  const existing = await prisma.report.count();
  if (existing > 0) {
    console.log(`→ Raportet demo u anashkaluan (${existing} raporte ekzistojnë tashmë).`);
    return;
  }

  const staff = await prisma.user.findFirst({
    where: { role: { name: { in: ["MUNICIPALITY_EMPLOYEE", "MUNICIPALITY_ADMIN"] } } },
    select: { id: true },
  });

  let counter = 0;
  const year = new Date().getFullYear();

  for (const [index, demo] of DEMO_REPORTS.entries()) {
    const [category, municipality] = await Promise.all([
      prisma.category.findUniqueOrThrow({ where: { slug: demo.categorySlug } }),
      prisma.municipality.findUniqueOrThrow({ where: { slug: demo.municipalitySlug } }),
    ]);

    const author = authors[index % authors.length]!;
    counter += 1;

    // Spread creation dates over the last ~6 weeks so charts have a shape.
    const createdAt = new Date(Date.now() - (DEMO_REPORTS.length - index) * 3.5 * 24 * 60 * 60 * 1000);
    const isResolved = demo.status === "COMPLETED";

    const report = await prisma.report.create({
      data: {
        title: demo.title,
        description: demo.description,
        slug: `${slugify(demo.title).slice(0, 60)}-${counter}`,
        reference: `RK-${year}-${String(counter).padStart(6, "0")}`,
        categoryId: category.id,
        municipalityId: municipality.id,
        latitude: demo.latitude,
        longitude: demo.longitude,
        address: demo.address,
        status: demo.status,
        priority: demo.priority,
        createdById: author.id,
        createdAt,
        viewsCount: Math.floor(Math.random() * 400) + 20,
        resolvedAt: isResolved ? new Date(createdAt.getTime() + 9 * 24 * 60 * 60 * 1000) : null,
        resolutionNote: isResolved
          ? "Puna u krye nga ekipi komunal dhe u verifikua në terren."
          : null,
        rejectionReason:
          demo.status === "REJECTED"
            ? "Kjo hapësirë nuk është në pronësi komunale. Raporti iu përcoll administruesit të pronës."
            : null,
        statusHistory: {
          create: [
            { toStatus: "PENDING", changedById: author.id, note: "Raporti u krijua.", createdAt },
            // Walk the same path the app enforces (STATUS_TRANSITIONS) instead of
            // jumping straight to the final status — otherwise the seeded history
            // describes a transition the platform itself would reject.
            ...(staff
              ? buildStatusChain(demo.status).map((entry, step) => ({
                  fromStatus: entry.from,
                  toStatus: entry.to,
                  changedById: staff.id,
                  note: STATUS_NOTES[entry.to],
                  createdAt: new Date(createdAt.getTime() + (step + 1) * 2 * 24 * 60 * 60 * 1000),
                }))
              : []),
          ],
        },
        followers: { create: { userId: author.id } },
      },
    });

    // Votes from every other demo account, so scores are non-trivial.
    const voters = authors.filter((user) => user.id !== author.id);
    let upvotes = 0;
    for (const voter of voters) {
      if (Math.random() > 0.25) {
        await prisma.vote.create({
          data: { reportId: report.id, userId: voter.id, type: "UPVOTE" },
        });
        upvotes += 1;
      }
    }

    const comments = [
      "Edhe unë e kam vërejtur këtë problem. Shpresoj të rregullohet shpejt.",
      "Faleminderit që e raportuat. E njëjta gjë ndodh edhe në rrugën fqinje.",
      "Sa kohë zakonisht duhet për t'u marrë përgjigje nga komuna?",
    ];
    let commentsCount = 0;
    for (const [commentIndex, body] of comments.entries()) {
      if (commentIndex > index % 3) break;
      const commenter = voters[commentIndex % voters.length];
      if (!commenter) continue;
      await prisma.comment.create({
        data: {
          reportId: report.id,
          userId: commenter.id,
          body,
          createdAt: new Date(createdAt.getTime() + (commentIndex + 1) * 60 * 60 * 1000),
        },
      });
      commentsCount += 1;
    }

    await prisma.report.update({
      where: { id: report.id },
      data: { upvotes, score: upvotes, commentsCount, followersCount: 1 },
    });
  }

  // Reconcile the denormalised profile counters after the bulk insert.
  for (const author of authors) {
    const [reportsCount, resolvedCount, votesReceived] = await Promise.all([
      prisma.report.count({ where: { createdById: author.id } }),
      prisma.report.count({ where: { createdById: author.id, status: "COMPLETED" } }),
      prisma.vote.count({ where: { report: { createdById: author.id }, type: "UPVOTE" } }),
    ]);
    await prisma.profile.updateMany({
      where: { userId: author.id },
      data: { reportsCount, resolvedCount, votesReceived },
    });
  }

  console.log(`→ ${DEMO_REPORTS.length} raporte demo me vota dhe komente.`);
}

async function main() {
  console.log("Duke mbjellë të dhënat e RregulloKosovën…\n");

  await seedReferenceData();
  await seedAdmin();

  if (SEED_DEMO) {
    console.log("\n→ Përmbajtja demo (SEED_DEMO=true)…");
    const users = await seedDemoUsers();
    await seedDemoReports(users);
    console.log("\n   Fjalëkalimi i llogarive demo: Demo1234");
  } else {
    console.log("\n→ Përmbajtja demo u anashkalua. Përdorni SEED_DEMO=true për ta aktivizuar.");
  }

  console.log("\nMbjellja përfundoi.");
}

main()
  .catch((error) => {
    console.error("Mbjellja dështoi:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
