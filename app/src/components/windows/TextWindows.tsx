"use client";

import { useI18n } from "@/lib/i18n";
import { Lockie } from "@/components/os/Lockie";
import { useOS } from "@/components/os/OS";
import { TierShield } from "@/components/os/icons";
import { TIERS } from "@/lib/campaign";

export function ReadMeWindow() {
  const { t } = useI18n();
  const { open } = useOS();
  return (
    <div>
      <div className="flex items-center gap-4">
        <Lockie mood="guarding" size={96} className="shrink-0" />
        <h1 className="pixel-title text-2xl leading-tight">{t.home.title}</h1>
      </div>
      <ul className="mt-4 space-y-3">
        {TIERS.map((tier, i) => (
          <li key={tier} className="flex items-start gap-3 leading-relaxed">
            <TierShield tier={tier} size={32} />
            <span>{t.os.readme.tiers[i]}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="btn-primary mt-5 w-full" onClick={() => open("groupbuys")}>
        {t.os.readme.browse}
      </button>
    </div>
  );
}

export function RulesWindow() {
  const { t } = useI18n();
  const r = t.os.rules;
  return (
    <div>
      <h2 className="pixel-title text-lg">{r.compare}</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse border-2 border-ink text-[13px]">
          <thead>
            <tr>
              {r.headers.map((h) => (
                <th key={h} scope="col" className="border-2 border-ink bg-line p-2 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row, i) => (
              <tr key={row[0]}>
                {row.map((cell, j) => (
                  <td key={j} className="border-2 border-ink p-2">
                    {j === 0 ? (
                      <span className="flex items-center gap-2 font-semibold">
                        <TierShield tier={TIERS[i]} size={24} />
                        {cell}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 leading-relaxed">{r.formula}</p>
      <p className="mt-2 leading-relaxed">{r.always}</p>
      <h2 className="pixel-title mt-5 text-lg">{r.threats}</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
        {r.threatItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PrivacyWindow() {
  const { t } = useI18n();
  return (
    <div>
      <h2 className="pixel-title text-lg">{t.privacy.title}</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
        {t.privacy.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="pixel-title mt-5 text-lg">{t.terms.title}</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 leading-relaxed">
        {t.terms.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <a href="https://github.com/manxichen-boop/dropsafe" target="_blank" rel="noreferrer" className="mt-4 inline-block underline underline-offset-4">
        {t.footer.source}
      </a>
    </div>
  );
}
