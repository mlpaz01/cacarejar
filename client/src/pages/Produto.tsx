import { AppLayout } from "@/components/AppLayout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  FileCheck2,
  Landmark,
  PackageCheck,
  ShieldCheck,
  Star,
} from "lucide-react";

const commercialChecklist = [
  "3 ciclos internos completos com negocios reais",
  "1 estudo de caso com antes/depois e aprendizados",
  "Fluxo de creditos e PIX validado",
  "Onboarding novo usuario testado sem ajuda",
  "Termos, limites e promessa comercial revisados",
  "Vitrine atualizada so depois de prova real",
];

export default function Produto() {
  const { data: wallet } = trpc.credits.wallet.useQuery();
  const packages = trpc.credits.packages.useQuery();
  const { data: diagnosis } = trpc.diagnosis.get.useQuery();
  const planItems = ((diagnosis as any)?.plano7Dias ?? []) as any[];
  const measured = planItems.filter((item: any) => item.resultado).length;
  const progress = [
    !!diagnosis,
    planItems.length > 0,
    measured > 0,
    (wallet?.balanceCC ?? 0) > 0,
  ].filter(Boolean).length;

  return (
    <AppLayout
      title="Produto comercial"
      subtitle="Base interna para transformar o uso proprio em oferta vendavel."
    >
      <section className="rounded-3xl bg-[#071b44] text-white p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-black text-white/60 uppercase tracking-widest flex items-center gap-2">
              <BadgeDollarSign className="w-4 h-4" /> Prontidao comercial
            </p>
            <h2 className="text-2xl font-black mt-2">
              Venda so quando o motor provar resultado interno
            </h2>
            <p className="text-sm text-white/75 mt-3 max-w-3xl">
              Esta tela organiza o que precisa estar verdadeiro antes de
              prometer para clientes: caso real, limite claro, credito, suporte
              e promessa honesta.
            </p>
          </div>
          <div className="rounded-2xl bg-white/10 border border-white/15 px-5 py-4 min-w-[170px]">
            <p className="text-xs font-black text-white/60 uppercase">
              Base atual
            </p>
            <p className="text-3xl font-black mt-1">{progress}/4</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        <Metric
          title="Diagnostico ativo"
          value={diagnosis ? "sim" : "nao"}
          icon={FileCheck2}
        />
        <Metric
          title="Plano semanal"
          value={planItems.length ? `${planItems.length} itens` : "vazio"}
          icon={PackageCheck}
        />
        <Metric title="Posts medidos" value={String(measured)} icon={Star} />
        <Metric
          title="Saldo CC"
          value={String(wallet?.balanceCC ?? 0)}
          icon={Landmark}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_.9fr] gap-5 mb-6">
        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-[#071b44] flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#ff3217]" /> Checklist antes
            de vender
          </h3>
          <div className="space-y-2 mt-5">
            {commercialChecklist.map((item, index) => (
              <label
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-3"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  defaultChecked={index < progress}
                />
                <span>
                  <span className="block text-sm font-black text-[#071b44]">
                    {item}
                  </span>
                  <span className="block text-xs text-[#61708a] mt-0.5">
                    {index < progress
                      ? "Ha sinal interno para este item."
                      : "Validar antes de usar como promessa comercial."}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-[#071b44]">
            Pacotes e limites
          </h3>
          <p className="text-sm text-[#61708a] mt-2">
            Use esta area para conferir se creditos, recarga e limites estao
            coerentes com a promessa.
          </p>
          <div className="space-y-2 mt-5">
            {packages.data ? (
              Object.entries(packages.data as any).map(([key, p]: any) => (
                <div
                  key={key}
                  className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-black text-[#071b44]">
                      {p.label}
                    </p>
                    <p className="text-xs text-[#61708a]">
                      {p.cc.toLocaleString("pt-BR")} CC
                    </p>
                  </div>
                  <span className="text-sm font-black text-[#ff3217]">
                    R$ {(p.cents / 100).toFixed(0)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#61708a]">Carregando pacotes...</p>
            )}
          </div>
          <Link href="/creditos">
            <a className="mt-5 rounded-xl bg-[#071b44] text-white px-4 py-2 text-xs font-black inline-flex items-center gap-2">
              Abrir carteira <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-[#e6ebf3] bg-white p-6 shadow-sm">
        <h3 className="text-xl font-black text-[#071b44]">
          Promessa comercial segura
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <Promise
            title="Prometer"
            items={[
              "Diagnostico acionavel",
              "Plano semanal",
              "Criativos editaveis",
              "Aprendizado por resultado",
            ]}
          />
          <Promise
            title="Nao prometer ainda"
            items={[
              "Resultado garantido",
              "Automacao total",
              "Gestao completa de trafego",
              "Postar sozinho em todos canais",
            ]}
          />
          <Promise
            title="Prova necessaria"
            items={[
              "Prints de antes/depois",
              "Posts publicados",
              "Metricas reais",
              "Relato do processo",
            ]}
          />
        </div>
      </section>
    </AppLayout>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: any;
}) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-white p-5 shadow-sm">
      <Icon className="w-5 h-5 text-[#ff3217]" />
      <p className="text-[10px] font-black text-[#61708a] uppercase tracking-wide mt-3">
        {title}
      </p>
      <p className="text-xl font-black text-[#071b44] mt-1">{value}</p>
    </div>
  );
}

function Promise({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-[#e6ebf3] bg-[#fbfcff] p-4">
      <h4 className="text-sm font-black text-[#071b44] flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-[#18b85c]" /> {title}
      </h4>
      <div className="space-y-2 mt-3">
        {items.map(item => (
          <p
            key={item}
            className="text-xs font-semibold text-[#22304b] leading-snug"
          >
            - {item}
          </p>
        ))}
      </div>
    </div>
  );
}
