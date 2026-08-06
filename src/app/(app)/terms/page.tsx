import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Kushtet e përdorimit",
  description: `Rregullat e përdorimit të platformës ${APP_NAME}.`,
  alternates: { canonical: "/terms" },
};

export const revalidate = 86400;

const LAST_UPDATED = "1 janar 2026";

export default function TermsPage() {
  return (
    <div className="container max-w-3xl">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight">Kushtet e përdorimit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Përditësuar së fundmi: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Pranimi i kushteve</h2>
          <p className="mt-3 text-muted-foreground">
            Duke krijuar një llogari ose duke përdorur {APP_NAME}, ju pranoni këto kushte. Nëse nuk
            pajtoheni me to, ju lutemi mos e përdorni platformën.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Përdorimi i pranueshëm</h2>
          <p className="mt-3 text-muted-foreground">Ju pajtoheni që të mos:</p>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Dërgoni raporte të rreme, mashtruese ose qëllimisht të pasakta.</li>
            <li>
              Publikoni përmbajtje shpifëse, fyese, raciste ose që nxit urrejtje apo dhunë.
            </li>
            <li>
              Ngarkoni foto që shfaqin persona të identifikueshëm pa pëlqimin e tyre, targa
              automjetesh ose të dhëna personale të të tretëve.
            </li>
            <li>Përdorni mjete automatike për të krijuar raporte, vota ose komente masive.</li>
            <li>Provoni të anashkaloni kontrollet e sigurisë ose kufijtë e shpejtësisë.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Përmbajtja juaj</h2>
          <p className="mt-3 text-muted-foreground">
            Ju mbani të drejtat mbi përmbajtjen që publikoni. Duke e publikuar, jepni një licencë
            jo-ekskluzive dhe pa pagesë për ta shfaqur atë publikisht në platformë dhe për t&apos;ia
            përcjellë komunës përkatëse me qëllim zgjidhjen e problemit.
          </p>
          <p className="mt-3 text-muted-foreground">
            Ju jeni përgjegjës për saktësinë e asaj që raportoni.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Moderimi</h2>
          <p className="mt-3 text-muted-foreground">
            Stafi komunal mund të verifikojë, refuzojë ose shënojë si dublikat çdo raport, duke
            dhënë një arsye publike. Administratorët mund të fshijnë përmbajtje që shkel këto kushte
            dhe të bllokojnë llogari në rast shkeljesh të përsëritura.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Pa garanci shërbimi</h2>
          <p className="mt-3 text-muted-foreground">
            Platforma ofron një kanal komunikimi. Ajo nuk garanton se një problem i raportuar do të
            zgjidhet, as brenda një afati të caktuar — vendimi dhe burimet i takojnë komunës
            përgjegjëse.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Llogaria juaj</h2>
          <p className="mt-3 text-muted-foreground">
            Ju jeni përgjegjës për ruajtjen e fjalëkalimit tuaj. Mund ta fshini llogarinë në çdo
            kohë te{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Cilësimet
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Ndryshimet</h2>
          <p className="mt-3 text-muted-foreground">
            Këto kushte mund të përditësohen. Ndryshimet thelbësore do të njoftohen brenda
            platformës përpara se të hyjnë në fuqi.
          </p>
        </section>
      </div>
    </div>
  );
}
