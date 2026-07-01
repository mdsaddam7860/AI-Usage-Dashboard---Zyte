import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CACHE_DIR = path.join(__dirname, "../../", ".cache");
// const CACHE_TTL_MS = 12 * 24 * 60 * 60 * 1000; // 59 minutes
const CACHE_TTL_MS = 59 * 60 * 1000; // 59 minutes
import { logger } from "../index.js";

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readCache(filename) {
  try {
    const filePath = path.join(CACHE_DIR, filename);
    if (!fs.existsSync(filePath)) return null;

    const { savedAt, data } = JSON.parse(fs.readFileSync(filePath, "utf8"));
    const ageMs = Date.now() - new Date(savedAt).getTime();

    if (ageMs > CACHE_TTL_MS) {
      logger.debug(
        `Cache stale (${Math.round(ageMs / 1000)}s old): ${filename}`
      );
      return null;
    }

    logger.debug(`Cache hit (${Math.round(ageMs / 1000)}s old): ${filename}`);
    return data;
  } catch {
    return null;
  }
}

/**
 * Writes data wrapped in a { savedAt, data } envelope so TTL can be checked on read.
 */
function writeCache(filename, data) {
  try {
    ensureCacheDir();
    const envelope = { savedAt: new Date().toISOString(), data };
    fs.writeFileSync(
      path.join(CACHE_DIR, filename),
      JSON.stringify(envelope, null, 2),
      "utf8"
    );
    logger.info(`Cached scraped data to ${path.join(CACHE_DIR, filename)}`);
  } catch (err) {
    logger.error(`Cache write failed for ${filename}: ${err.message}`);
  }
}

const TeamObject = {
  "it-support@zyte.com": "IT",
  "ivan.sanchez@zyte.com": "R&D Web Data Pod",
  "julia@zyte.com": "R&D Web Data Pod",
  "john.rooney@zyte.com": "Marketing",
  "lucas.solorzano@zyte.com": "Finance",
  "alejandro.mendez@zyte.com": "Finance",
  "lacuesta@zyte.com": "SAAS Squad",
  "erik.farell@zyte.com": "EE Squad",
  "mauro.mattos@zyte.com": "EE Squad",
  "muhammad.saad@zyte.com": "Quality Assurance",
  "shane@zyte.com": "SLT; SLT",
  "dori.kiss@zyte.com": "Customer Operations",
  "gergely.szabo@zyte.com": "Customer Operations",
  "jordi.yherla@zyte.com": "Infosec",
  "juan.lopez@zyte.com": "Quality Assurance",
  "victor.canarias@zyte.com": "Technology Senior Leadership",
  "jakub.lazinski@zyte.com": "Product",
  "shuai@zyte.com": "Infrastructure",
  "helma.larkin@zyte.com": "SLT",
  "joaquin@zyte.com": "Infrastructure",
  "qasim.mehmood@zyte.com": "Infrastructure",
  "jan.seidler@zyte.com": "SLT; SLT",
  "luar@zyte.com": "Infrastructure",
  "suzanne@zyte.com": "SLT; SLT",
  "sumeet.gandhi@zyte.com": "Technology Senior Leadership",
  "felipe.decarli@zyte.com": "Sales",
  "ali@zyte.com": "Sales",
  "comber@zyte.com": "Sales",
  "afzal@zyte.com": "Sales",
  "pedro.barazetti@zyte.com": "Sales",
  "leon.repalust@zyte.com": "Sales",
  "guilherme.rodrigues@zyte.com": "Sales",
  "peter.malits@zyte.com": "Infosec",
  "bartlomiej.piatek@zyte.com": "Finance",
  "victoria.vlahoyiannis@zyte.com": "Legal",
  "agustin@zyte.com": "Infrastructure",
  "santiago.iturriaga@zyte.com": "Infrastructure",
  "valter.sciarrillo@zyte.com": "Product",
  "diego.rodrigues@zyte.com": "Sales",
  "taras@zyte.com": "R&D Antiban Pod",
  "mayank.singhal@zyte.com": "Core Squad",
  "cleber.duranti@zyte.com": "Customer Operations",
  "angel.munoz@zyte.com": "Web Portal Squad",
  "martin.hartmann@zyte.com": "Product Operations",
  "josu@zyte.com": "Web Portal Squad",
  "gaetan.belsack@zyte.com": "Product",
  "aline.santos@zyte.com": "Sales",
  "eric.webb@zyte.com": "Sales",
  "meng.xipeng@zyte.com": "Antiban Squad",
  "dany.farina@zyte.com": "API Squad",
  "rafael@zyte.com": "SAAS Squad",
  "asif@zyte.com": "SAAS Squad",
  "dongkuo@zyte.com": "Edge Squad",
  "theresia.tanzil@zyte.com": "Marketing",
  "nagharajan.rathina@zyte.com": "Product",
  "mikhail.shnyr@zyte.com": "API Squad",
  "hrvoje.pikl@zyte.com": "HR",
  "andrew.toner@zyte.com": "Sales",
  "carlos.costa@zyte.com": "Product",
  "thomas.reeve@zyte.com": "Product",
  "szilard.nemes@zyte.com": "AI Squad",
  "aleksandra.klyszcz@zyte.com": "SAAS Squad",
  "liam.ocallaghan@zyte.com": "Sales",
  "barbara.rangel@zyte.com": "Sales",
  "marcela.delgado@zyte.com": "Sales",
  "thriveni@zyte.com": "Customer Operations",
  "dejan@zyte.com": "Sales",
  "ivan.vaskevych@zyte.com": "API Squad",
  "ernesto.hilvano@zyte.com": "API Squad",
  "james.kehoe@zyte.com": "Product",
  "rui.ferreira@zyte.com": "Core Squad",
  "marie@zyte.com": "SLT",
  "abhijeet.nautiyal@zyte.com": "Product",
  "iain.lennon@zyte.com": "SLT; SLT",
  "benjamin.marquis@zyte.com": "Sales",
  "cristi@zyte.com": "R&D Antiban Pod; R&D Web Data Pod",
  "eric@zyte.com": "HR",
  "robert@zyte.com": "Customer Operations",
  "usama.rashid@zyte.com": "Quality Assurance",
  "bala.ravichandran@zyte.com": "Product",
  "ante.miocic@zyte.com": "SAAS Squad",
  "juan.mercado@zyte.com": "Finance",
  "vanessa.winter@zyte.com": "Sales",
  "ana.martins@zyte.com": "Customer Operations",
  "artem.furmanov@zyte.com": "SAAS Squad",
  "andres@zyte.com": "Sales",
  "brendan@zyte.com": "Finance",
  "peter.nealon@zyte.com": "SLT; SLT",
  "ednei.bach@zyte.com": "Product Operations",
  "mushtaq.ali@zyte.com": "Web Portal Squad",
  "ken@zyte.com": "Customer Operations",
  "lucas.pescador@zyte.com": "Sales",
  "jorge.melgar@zyte.com": "Product",
  "brendan.flynn@zyte.com": "Sales",
  "chandral.thakor@zyte.com": "Product Operations",
  "claire.brady@zyte.com": "HR",
  "sally.hinfey@zyte.com": "SLT; SLT",
  "ozren.buric@zyte.com": "Marketing",
  "peter.soltesz@zyte.com": "Web Portal Squad",
  "ayan.pahwa@zyte.com": "Marketing",
  "arkadiusz.janeczko@zyte.com": "Product",
  "ivan@zyte.com": "Quality Assurance",
  "geron@zyte.com": "Antiban Squad",
  "asaf.dekel@zyte.com": "Sales",
  "akshay@zyte.com": "Technology Senior Leadership",
  "bulat@zyte.com": "Antiban Squad",
  "ganesh@zyte.com": "Product",
  "beatriz.santos@zyte.com": "HR",
  "manoj.kamal@zyte.com": "Product",
  "vinicius.machado@zyte.com": "Web Portal Squad",
  "mariarosaria.turizio@zyte.com": "Sales",
  "nestor@zyte.com": "Product",
  "rakesh@zyte.com": "AI Squad",
  "abdul.muhib@zyte.com": "Product",
  "runa.Woronowicz@zyte.com": "Product",
  "janin.kolenc@zyte.com": "API Squad",
  "daniel.kiss@zyte.com": "Technology Senior Leadership",
  "shahzad.akram@zyte.com": "Product; Quality Assurance",
  "adnan.ashraf@zyte.com": "Marketing",
  "abidemi.olaniyan@zyte.com": "Legal",
  "tarcia.giannini@zyte.com": "HR",
  "miguel.nunes@zyte.com": "Sales",
  "lucy@zyte.com": "Edge Squad",
  "sajan.shetty@zyte.com": "Product",
  "manik.soi@zyte.com": "IT",
  "shaunie@zyte.com": "R&D Antiban Pod; R&D Web Data Pod",
  "samanta.amaral@zyte.com": "Customer Operations",
  "neeraj@zyte.com": "Sales",
  "gabriel.alves@zyte.com": "Infrastructure",
  "pawel@zyte.com": "Product",
  "blanca.gonzalez@zyte.com": "Sales",
  "yogesh.bhatia@zyte.com": "Sales",
  "daniel.cave@zyte.com": "Product",
  "tiago.sampaio@zyte.com": "Sales",
  "sergey.zuev@zyte.com": "AI Squad",
  "christophe.cottrell@zyte.com": "Sales",
  "mitch.holt@zyte.com": "Marketing",
  "linda.giuliano@zyte.com": "Product",
  "ionut.ciubotariu@zyte.com": "Antiban Squad",
  "thaisa.lima@zyte.com": "Sales",
  "nikhil@zyte.com": "Finance",
  "teresa@zyte.com": "Finance",
  "mikhail@zyte.com": "EE Squad",
  "jose.vargas@zyte.com": "Sales",
  "sibiryakov@zyte.com": "Core Squad",
};

function getTeam(email) {
  if (email in TeamObject) {
    return TeamObject[email];
  }
  return "Unassigned";
}

export { readCache, writeCache, TeamObject, getTeam };
