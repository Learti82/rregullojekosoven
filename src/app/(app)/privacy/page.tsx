import type { Metadata } from "next";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Politika e privatësisë",
  description: `Si i mbledh, përdor dhe mbron ${APP_NAME} të dhënat tuaja personale.`,
  alternates: { canonical: "/privacy" },
};

export const revalidate = 86400;

const LAST_UPDATED = "1 janar 2026";

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl">
      <header className="mb-10">
        <h1 className="font-display text-4xl font-bold tracking-tight">Politika e privatësisë</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Përditësuar së fundmi: {LAST_UPDATED}
        </p>
      </header>

      <div className="space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="font-display text-xl font-semibold">1. Çfarë të dhënash mbledhim</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>
              <strong className="text-foreground">Të dhëna llogarie:</strong> emri, emri i
              përdoruesit, adresa e email-it dhe fjalëkalimi (i ruajtur vetëm si hash bcrypt — teksti
              origjinal nuk ruhet kurrë).
            </li>
            <li>
              <strong className="text-foreground">Përmbajtja që krijoni:</strong> raportet, fotot,
              komentet, votat dhe koordinatat gjeografike që zgjidhni.
            </li>
            <li>
              <strong className="text-foreground">Të dhëna teknike:</strong> koha e veprimeve dhe një
              version i hash-uar i adresës IP, i përdorur vetëm për kufizimin e abuzimit. Adresa IP e
              plotë nuk ruhet.
            </li>
            <li>
              <strong className="text-foreground">Opsionale:</strong> numri i telefonit, qyteti dhe
              bio, nëse zgjidhni t&apos;i shtoni.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">2. Çfarë është publike</h2>
          <p className="mt-3 text-muted-foreground">
            Raportet, fotot, komentet dhe numri i votave janë <strong>publike</strong> —
            transparenca është qëllimi i platformës. Emri dhe emri i përdoruesit shfaqen pranë
            përmbajtjes suaj, përveç kur zgjidhni opsionin &ldquo;Publiko në mënyrë anonime&rdquo;.
          </p>
          <p className="mt-3 text-muted-foreground">
            Email-i, numri i telefonit dhe fjalëkalimi nuk shfaqen kurrë publikisht.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">3. Vendndodhja</h2>
          <p className="mt-3 text-muted-foreground">
            Vendndodhja kërkohet vetëm kur ju e nisni veprimin dhe përdoret ekskluzivisht për të
            pozicionuar raportin në hartë. Ju mund ta zgjidhni pikën manualisht dhe të mos jepni
            fare qasje në GPS. Ne nuk gjurmojmë vendndodhjen tuaj në sfond.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">4. Ndarja me palët e treta</h2>
          <p className="mt-3 text-muted-foreground">
            Nuk i shesim dhe nuk i ndajmë të dhënat tuaja për qëllime marketingu. Të dhënat e një
            raporti u bëhen të disponueshme punonjësve të komunës përkatëse, të cilët mund t&apos;ju
            kontaktojnë për sqarime. Përdorim ofrues infrastrukture (hosting, bazë të dhënash,
            ruajtje skedarësh) që i përpunojnë të dhënat vetëm sipas udhëzimeve tona.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">5. Të drejtat tuaja</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
            <li>Të shihni dhe të përditësoni të dhënat tuaja në çdo kohë te Cilësimet.</li>
            <li>
              Të fshini llogarinë tuaj. Raportet ruhen për interesin publik, por shkëputen nga
              identiteti juaj dhe shfaqen si anonime.
            </li>
            <li>Të tërhiqni pëlqimin për njoftimet me email në çdo moment.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">6. Siguria</h2>
          <p className="mt-3 text-muted-foreground">
            Komunikimi bëhet vetëm përmes HTTPS. Fjalëkalimet ruhen me bcrypt. Qasja në panelet
            komunale dhe administrative kontrollohet në server për çdo kërkesë. Ngarkimet e
            skedarëve validohen sipas llojit dhe madhësisë përpara pranimit.
          </p>
        </section>

        <section>
          <h2 className="font-display text-xl font-semibold">7. Kontakti</h2>
          <p className="mt-3 text-muted-foreground">
            Për çdo pyetje rreth privatësisë, kontaktoni administratorin e platformës përmes
            kanaleve zyrtare të publikuara nga institucioni pritës.
          </p>
        </section>
      </div>
    </div>
  );
}
