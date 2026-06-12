from pathlib import Path
from textwrap import dedent
import html
import subprocess
import time

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
MANUALS = ROOT / "docs" / "manuals"
SCREENS = MANUALS / "noseutempo_screens"
ASSETS = ROOT / "client" / "public" / "assets"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")

PDF = MANUALS / "manual_usuario_cacarejar_noseutempo.pdf"
HTML = MANUALS / "manual_usuario_cacarejar_noseutempo.html"
DOCX = MANUALS / "manual_usuario_cacarejar_noseutempo.docx"

BLUE = "#071b44"
ORANGE = "#ff3217"
MUTED = "#61708a"
LIGHT = "#f6f8fc"
BORDER = "#dde5f0"
GREEN = "#18b85c"


def esc(value: str) -> str:
    return html.escape(value or "")


def shell(cmd):
    return subprocess.run(cmd, check=True, capture_output=True, text=True)


BASE_CSS = """
*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#eef2f7;color:#071b44}
.frame{width:1280px;height:720px;background:#f3f6fb;display:grid;grid-template-columns:210px 1fr;overflow:hidden}
.side{background:#071b44;color:white;padding:22px 14px;display:flex;flex-direction:column;gap:22px}
.logo{width:160px;height:auto;margin-bottom:8px}.section{font-size:10px;color:#8190aa;text-transform:uppercase;font-weight:900;margin:8px 0}
.nav{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:12px;color:#b7c2d4;font-weight:800;font-size:14px}
.nav.active{background:#ff3217;color:white}.dot{width:16px;height:16px;border:2px solid currentColor;border-radius:4px}.content{overflow:hidden}
.top{height:72px;background:white;border-bottom:1px solid #dbe3ef;display:flex;align-items:center;justify-content:space-between;padding:0 24px}
.top h1{font-size:18px;margin:0;font-weight:950}.top p{font-size:13px;color:#61708a;margin:4px 0 0}.actions{display:flex;gap:10px}
.btn{border:1px solid #dbe3ef;background:white;border-radius:12px;padding:11px 15px;font-weight:900;color:#071b44}.btn.primary{background:#ff3217;color:white;border-color:#ff3217}.btn.navy{background:#071b44;color:white;border-color:#071b44}.btn.green{background:#18b85c;color:white;border-color:#18b85c}
.main{padding:22px 24px}.card{background:white;border:1px solid #dbe3ef;border-radius:18px;padding:18px;box-shadow:0 3px 12px rgba(7,27,68,.06)}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.label{font-size:11px;font-weight:950;color:#071b44;text-transform:uppercase;margin:0 0 8px}.input{height:44px;border:1px solid #dbe3ef;border-radius:12px;background:#f6f8fc;padding:12px;color:#61708a;font-weight:700;margin-bottom:10px}
.textarea{height:92px;border:1px solid #dbe3ef;border-radius:12px;background:#f6f8fc;padding:12px;color:#61708a;font-weight:700}.pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:11px;font-weight:950;background:#f6f8fc;border:1px solid #dbe3ef;margin:3px}
.hero{background:#071b44;color:white;border-radius:20px;padding:24px;display:flex;align-items:center;justify-content:space-between}.hero h2{font-size:25px;margin:0 0 4px}.hero p{margin:0;color:#c7d3e6}
.metric{border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:12px 18px;text-align:center;background:rgba(255,255,255,.08)}.metric b{display:block;font-size:22px;color:white}.metric span{font-size:10px;color:#b9c5d9;font-weight:900;text-transform:uppercase}
.title{font-size:17px;font-weight:950;margin:0 0 6px}.sub{font-size:12px;color:#61708a;margin:0 0 12px}.darkbox{background:#071b44;color:white;border-radius:14px;padding:16px;font-weight:850;line-height:1.45}
.mini{border:1px solid #dbe3ef;background:#fbfcff;border-radius:15px;padding:14px}.mini h3{font-size:15px;margin:0 0 8px}.mini p{font-size:12px;line-height:1.35;margin:0;color:#22304b}.tag{display:inline-block;background:#fff1ef;color:#ff3217;border:1px solid #ffd0c8;border-radius:8px;padding:4px 7px;font-size:10px;font-weight:950;margin:2px}
.post{overflow:hidden;padding:0}.post .img{height:170px;background:linear-gradient(135deg,#e9dcff,#0b1d49);display:flex;align-items:center;justify-content:center;color:white;font-size:34px;font-weight:950}.post .body{padding:12px}.post h3{font-size:13px;margin:0 0 6px}.post p{font-size:11px;line-height:1.3;color:#22304b;margin:0 0 8px}.likebar{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px}.smallbtn{border:1px solid #dbe3ef;border-radius:10px;padding:8px;text-align:center;font-size:11px;font-weight:950}.smallbtn.good{background:#18b85c;color:white;border-color:#18b85c}.smallbtn.bad{background:white;color:#c20f00;border-color:#ffd0c8}
.journey{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-bottom:16px}.step{border:1px solid #dbe3ef;border-radius:13px;background:white;padding:10px;font-size:11px;font-weight:950}.step.on{background:#fff1ef;border-color:#ff3217}.step.done{background:#eafff1;border-color:#bfeccb}
"""


def screen_html(title, subtitle, active, body, actions=""):
    navs = ["Dashboard", "Diagnóstico", "Radar de Mercado", "Criativos", "Aprovação", "Campanhas", "Métricas", "Acompanhamento"]
    nav_html = []
    for i, n in enumerate(navs):
        sec = '<div class="section">Estratégia</div>' if i == 0 else ('<div class="section">Criação</div>' if i == 3 else ('<div class="section">Veiculação</div>' if i == 4 else ('<div class="section">Resultados</div>' if i == 6 else "")))
        nav_html.append(sec + f'<div class="nav {"active" if n == active else ""}"><span class="dot"></span>{esc(n)}</div>')
    logo = (ASSETS / "logo-dark.png").as_posix()
    return f"""<!doctype html><html><head><meta charset='utf-8'><style>{BASE_CSS}</style></head><body>
    <div class="frame"><aside class="side"><img class="logo" src="file:///{logo}" />{''.join(nav_html)}<div style="margin-top:auto;font-weight:900;font-size:13px">NoSeuTempo<br><span style="color:#8fa0bd;font-size:11px">exemplo de uso</span></div></aside>
    <section class="content"><header class="top"><div><h1>{esc(title)}</h1><p>{esc(subtitle)}</p></div><div class="actions">{actions}</div></header><main class="main">{body}</main></section></div></body></html>"""


def journey(active_idx):
    labels = ["Diagnóstico", "Radar", "Aprovação", "Campanhas", "Métricas", "Acompanhamento"]
    return '<div class="journey">' + ''.join(f'<div class="step {"on" if i == active_idx else "done" if i < active_idx else ""}">{i+1}. {label}</div>' for i, label in enumerate(labels)) + '</div>'


def build_screen_sources():
    SCREENS.mkdir(parents=True, exist_ok=True)
    screens = []
    screens.append(("01-diagnostico-preenchido", screen_html(
        "Vamos estudar seu negócio",
        "O Agente Estrategista lê seus canais e monta um plano profissional.",
        "Diagnóstico",
        journey(0) + """
        <div class="grid2">
          <div class="card">
            <p class="label">Suas redes</p>
            <div class="input">Instagram: @noseutempo</div>
            <div class="input">TikTok: @noseutempo</div>
            <div class="input">LinkedIn: linkedin.com/company/noseutempo</div>
            <div class="input">Site: noseutempo.com.br</div>
            <p class="label">Contexto</p>
            <div class="textarea">Plataforma de aprendizagem adaptativa para pessoas neurodivergentes, com suporte da Geni IA.</div>
          </div>
          <div class="card">
            <p class="label">O que você vende?</p>
            <div class="textarea">Assinatura da plataforma NoSeuTempo para famílias, escolas e adultos neurodivergentes.</div>
            <p class="label" style="margin-top:18px">Objetivo agora</p>
            <span class="pill">Gerar leads</span><span class="pill">Crescer autoridade</span><span class="pill">Validar narrativa</span>
            <div style="height:18px"></div><button class="btn primary" style="width:100%;font-size:15px">Fazer o estudo do meu negócio</button>
          </div>
        </div>""",
        '<button class="btn">Ver Histórico</button>'
    )))
    screens.append(("02-diagnostico-resultado", screen_html(
        "Estudo do seu negócio",
        "Plano feito pelo Agente Estrategista",
        "Diagnóstico",
        journey(0) + """
        <div class="hero">
          <div><h2>@noseutempo</h2><p>Aprendizagem adaptativa para neurodivergentes</p></div>
          <div style="display:flex;gap:12px"><div class="metric"><span>Seguidores</span><b>0</b></div><div class="metric"><span>Posts</span><b>-</b></div><div class="metric"><span>Engajamento</span><b>-</b></div></div>
        </div>
        <div class="card" style="margin-top:16px">
          <p class="label" style="color:#ff3217">Parecer executivo</p>
          <p style="font-size:15px;line-height:1.55;font-weight:800">O NoSeuTempo tem oportunidade forte em educação inclusiva porque transforma esforço invisível em evidência concreta. A narrativa central é: a Geni vê o que família e escola não conseguem observar durante a aprendizagem.</p>
          <div class="darkbox" style="margin-top:12px">Objetivo: gerar os primeiros cadastros qualificados com conteúdo que devolve dignidade, mostra progresso e cria confiança.</div>
        </div>
        <div class="grid2" style="margin-top:16px"><div class="mini"><h3>Prescrição imediata</h3><p>Publicar 3 conteúdos de prova emocional e 1 conteúdo técnico por semana.</p></div><div class="mini"><h3>Canal prioritário</h3><p>LinkedIn para autoridade B2B; Instagram/TikTok para identificação familiar.</p></div></div>""",
        '<button class="btn">Atualizar</button><button class="btn primary">Gerar posts para aprovação</button><button class="btn">Exportar PDF</button>'
    )))
    screens.append(("03-visao-360", screen_html(
        "Visão 360 do LinkedIn",
        "Pessoas, áreas, tecnologias e interesses conectados ao diagnóstico.",
        "Diagnóstico",
        journey(0) + """
        <div class="card">
          <p class="title">Visão 360: interesses pelos posts</p><p class="sub">Sinais inferidos dos canais, Radar e ideias marcadas.</p>
          <div class="grid2">
            <div class="mini"><span class="tag">TECNOLOGIA</span><h3>Aprendizagem adaptativa e agentes</h3><p>Mostre a tecnologia como ganho concreto, não como novidade abstrata.</p><p style="margin-top:8px"><b>LinkedIn:</b> antes/depois da jornada do aluno.</p></div>
            <div class="mini"><span class="tag">PERSONA</span><h3>Famílias e educadores</h3><p>Conteúdos com rosto humano, prova social e explicação acolhedora geram confiança.</p></div>
            <div class="mini"><span class="tag">DOR</span><h3>Esforço invisível</h3><p>Nomear a tentativa repetida sem julgamento abre conversa com pais e escolas.</p></div>
            <div class="mini"><span class="tag">B2B</span><h3>Escolas inclusivas</h3><p>Diretores precisam justificar escolha por evidência, segurança e ganho pedagógico.</p></div>
          </div>
        </div>
        <div class="card" style="margin-top:16px"><p class="title">Públicos para LinkedIn Ads</p><span class="pill">Diretores pedagógicos</span><span class="pill">Coordenadores de inclusão</span><span class="pill">Edtechs</span><span class="pill">Clínicas parceiras</span></div>""",
        '<button class="btn primary">Usar Feedbacks no diagnóstico</button>'
    )))
    screens.append(("04-radar-feedback", screen_html(
        "Radar de Mercado",
        "O Agente Radar pesquisa os hits do setor e adapta para a marca.",
        "Radar de Mercado",
        journey(1) + """
        <div class="card">
          <p class="title">O que está quente agora</p><p class="sub">O nicho de educação inclusiva responde a conteúdos que tornam visível o esforço de aprender.</p>
          <div class="darkbox">Posts que mostram tentativas, áudio repetido e progresso pequeno têm maior aderência emocional do que promessas genéricas de tecnologia.</div>
        </div>
        <div class="grid4" style="margin-top:16px">
          <div class="card post"><div class="img">11x</div><div class="body"><h3>@psicopedagogaheloisa</h3><p>A família viu uma página em branco. A Geni viu 11 tentativas.</p><span class="tag">95 hot</span><div class="likebar"><div class="smallbtn good">Gostei</div><div class="smallbtn">Não gostei</div></div></div></div>
          <div class="card post"><div class="img">6x</div><div class="body"><h3>@educacaoinclusiva</h3><p>Ele ouviu o mesmo áudio 6 vezes. Isso não é distração.</p><span class="tag">88 hot</span><div class="likebar"><div class="smallbtn good">Gostei</div><div class="smallbtn">Não gostei</div></div></div></div>
          <div class="card post"><div class="img">?</div><div class="body"><h3>@tdahnaescola</h3><p>Quando a criança para, o sistema costuma desistir antes dela.</p><span class="tag">82 hot</span><div class="likebar"><div class="smallbtn">Gostei</div><div class="smallbtn bad">Não gostei</div></div></div></div>
          <div class="card post"><div class="img">A+</div><div class="body"><h3>@neurodiversidade</h3><p>Prova social com famílias reais e linguagem sem julgamento.</p><span class="tag">76 hot</span><div class="likebar"><div class="smallbtn">Gostei</div><div class="smallbtn">Não gostei</div></div></div></div>
        </div>""",
        '<button class="btn navy">Iniciar Radar</button><button class="btn primary">Usar Feedback para refazer a pesquisa</button>'
    )))
    screens.append(("05-aprovacao-posts", screen_html(
        "Revisar e publicar",
        "A última conferência antes dos Agentes colocarem dinheiro em mídia.",
        "Aprovação",
        journey(2) + """
        <div class="card">
          <p class="title">Posts do NoSeuTempo</p><p class="sub">3 de 3 posts selecionados para revisão final.</p>
          <div class="grid3">
            <div class="card post"><div class="img">Geni</div><div class="body"><h3>A página em branco não conta a história toda</h3><p>A Geni mostra cada tentativa invisível antes da resposta final.</p><div class="smallbtn good">Aprovado</div></div></div>
            <div class="card post"><div class="img">Áudio</div><div class="body"><h3>Repetir não é falhar</h3><p>Quando uma criança ouve 6 vezes, talvez esteja processando diferente.</p><div class="smallbtn good">Aprovado</div></div></div>
            <div class="card post"><div class="img">Escola</div><div class="body"><h3>Inclusão precisa de evidência</h3><p>O NoSeuTempo entrega sinais para família, escola e terapeuta decidirem melhor.</p><div class="smallbtn good">Aprovado</div></div></div>
          </div>
        </div>
        <div class="grid2" style="margin-top:16px"><div class="mini"><h3>Verba diária</h3><p>Recomendado: R$ 30/dia. Começa dividido entre os posts e depois puxa mais verba para vencedores.</p></div><div class="mini"><h3>Editar antes de aprovar</h3><p>Use Editar/Regerar quando imagem, CTA ou copy precisarem de ajuste.</p></div></div>""",
        '<button class="btn primary">Aprovar e publicar</button>'
    )))
    screens.append(("06-campanhas-metricas", screen_html(
        "Campanhas e Métricas",
        "Controle de execução e leitura do Agente sobre os primeiros sinais.",
        "Métricas",
        journey(4) + """
        <div class="grid2">
          <div class="card"><p class="title">Sala de controle</p><div class="grid2"><div class="mini"><h3>Ativas</h3><p style="font-size:28px;font-weight:950">1</p></div><div class="mini"><h3>Verba usada</h3><p style="font-size:28px;font-weight:950">R$ 180</p></div><div class="mini"><h3>Saldo</h3><p style="font-size:28px;font-weight:950">R$ 720</p></div><div class="mini"><h3>Campanhas</h3><p style="font-size:28px;font-weight:950">2</p></div></div></div>
          <div class="card"><p class="title">O que os números estão dizendo</p><p class="sub">Leitura do Agente</p><div class="darkbox">O CTR está bom, mas a conversão ainda não apareceu. Revise CTA e página antes de escalar verba.</div><div style="margin-top:14px"><span class="pill">CTR 2,8%</span><span class="pill">CPL aguardando</span><span class="pill">Cliques 143</span></div></div>
        </div>
        <div class="card" style="margin-top:16px"><p class="title">Decisão recomendada</p><p>Manter o post “A página em branco” por mais 48h, pausar o criativo mais fraco e testar CTA para cadastro gratuito.</p></div>""",
        '<button class="btn primary">Abrir acompanhamento</button>'
    )))
    screens.append(("07-acompanhamento", screen_html(
        "Acompanhamento",
        "Transforme o diagnóstico em execução, registre evolução e recalcule a rota.",
        "Acompanhamento",
        journey(5) + """
        <div class="grid2">
          <div class="hero" style="display:block"><p style="text-transform:uppercase;font-size:11px;color:#b9c5d9;font-weight:950">Ciclo de execução</p><h2>Semana 2</h2><p>Progresso do cronograma</p><div style="height:12px;background:rgba(255,255,255,.15);border-radius:999px;margin:16px 0"><div style="width:46%;height:12px;background:#ff3217;border-radius:999px"></div></div><p><b>Próximo foco:</b> ajustar CTA e gerar prova social com famílias.</p></div>
          <div class="card"><p class="title">Check-in do usuário</p><div class="textarea" style="height:170px">Publicamos 3 posts. O post da página em branco teve mais salvamentos. A escola parceira pediu material para reunião pedagógica. Ainda não houve cadastro suficiente.</div><button class="btn primary" style="margin-top:14px">Recalcular com evolução</button></div>
        </div>
        <div class="grid2" style="margin-top:16px"><div class="mini"><h3>Feito</h3><p>3 posts publicados, 1 campanha ativa, primeira leitura de CTR.</p></div><div class="mini"><h3>Nova prescrição</h3><p>Usar prova social e landing com promessa mais direta para cadastro.</p></div></div>"""
    )))
    return screens


def write_and_capture_screens():
    for name, content in build_screen_sources():
        html_path = SCREENS / f"{name}.html"
        png_path = SCREENS / f"{name}.png"
        html_path.write_text(content, encoding="utf-8")
        url = "file:///" + html_path.as_posix()
        cmd = [
            str(CHROME),
            "--headless",
            "--disable-gpu",
            "--allow-file-access-from-files",
            "--window-size=1280,720",
            f"--screenshot={png_path}",
            url,
        ]
        subprocess.run(cmd, check=True)
        time.sleep(0.2)


def build_manual_html():
    logo = (ASSETS / "logo-dark.png").as_posix()
    shots = [
        ("1. Preencher o diagnóstico", "O NoSeuTempo informa canais e contexto do negócio para o Agente Estrategista cruzar as referências.", "01-diagnostico-preenchido.png"),
        ("2. Ler o parecer e a prescrição", "O resultado separa análise estratégica, objetivo, prioridades e ações por canal.", "02-diagnostico-resultado.png"),
        ("3. Explorar a Visão 360", "Para LinkedIn e B2B, a plataforma identifica públicos, áreas, tecnologias e interesses acionáveis.", "03-visao-360.png"),
        ("4. Ensinar o Radar com feedbacks", "O usuário marca posts úteis com Gostei e remove ruído com Não gostei antes de refazer a pesquisa.", "04-radar-feedback.png"),
        ("5. Aprovar posts e verba", "Os posts gerados ficam em Aprovação com opção de editar/regerar e definir verba diária.", "05-aprovacao-posts.png"),
        ("6. Ler campanhas e métricas", "Campanhas mostra execução; Métricas mostra reação do mercado e próxima decisão recomendada.", "06-campanhas-metricas.png"),
        ("7. Registrar evolução", "Acompanhamento transforma execução em aprendizado e recalcula a rota com dados reais.", "07-acompanhamento.png"),
    ]
    shot_html = "\n".join(
        f"""<section class="step"><h2>{esc(title)}</h2><p>{esc(text)}</p><img src="noseutempo_screens/{img}" alt="{esc(title)}" /></section>"""
        for title, text, img in shots
    )
    HTML.write_text(dedent(f"""
    <!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Manual do usuário - Cacarejar com exemplo NoSeuTempo</title>
      <style>
        @page {{ size: A4; margin: 12mm 11mm; }}
        * {{ box-sizing: border-box; }}
        body {{ margin:0; font-family: Inter, Arial, sans-serif; color:{BLUE}; background:white; font-size:11pt; line-height:1.45; }}
        h1,h2,h3,p {{ margin:0; }}
        .cover {{ min-height: 273mm; border-radius:18px; padding:18mm; color:white; background:radial-gradient(circle at 88% 8%, rgba(255,50,23,.34), transparent 30%), linear-gradient(135deg,#06173b,#0d2a5e); position:relative; overflow:hidden; page-break-after:always; }}
        .cover:after {{ content:""; position:absolute; right:-28mm; bottom:-28mm; width:90mm; height:90mm; border-radius:50%; border:1px solid rgba(255,255,255,.16); }}
        .cover img {{ width:58mm; margin-bottom:32mm; }}
        .eyebrow {{ color:#ff715a; font-weight:950; letter-spacing:.08em; text-transform:uppercase; font-size:10pt; margin-bottom:3mm; }}
        h1 {{ font-size:30pt; line-height:1.03; max-width:150mm; }}
        .sub {{ color:rgba(255,255,255,.84); font-size:14pt; max-width:150mm; margin-top:5mm; }}
        .cover-card {{ margin-top:14mm; border:1px solid rgba(255,255,255,.16); background:rgba(255,255,255,.08); border-radius:14px; padding:6mm; max-width:150mm; }}
        .meta {{ display:grid; grid-template-columns:30mm 1fr; max-width:142mm; margin-top:12mm; border:1px solid rgba(255,255,255,.16); border-radius:12px; overflow:hidden; }}
        .meta div {{ padding:3mm 4mm; border-bottom:1px solid rgba(255,255,255,.12); }}
        .meta div:nth-child(odd) {{ background:rgba(255,255,255,.06); color:rgba(255,255,255,.7); font-weight:950; }}
        .meta div:nth-last-child(-n+2) {{ border-bottom:0; }}
        .intro {{ break-inside:avoid; margin-bottom:6mm; }}
        h2 {{ font-size:16pt; color:{BLUE}; margin:0 0 2mm; }}
        h3 {{ font-size:12pt; color:{ORANGE}; margin:5mm 0 2mm; }}
        p {{ margin-bottom:3mm; }}
        table {{ width:100%; border-collapse:separate; border-spacing:0; margin:4mm 0 6mm; font-size:9.3pt; break-inside:avoid; }}
        th,td {{ border-right:1px solid {BORDER}; border-bottom:1px solid {BORDER}; padding:2.5mm 3mm; vertical-align:top; }}
        th:first-child,td:first-child {{ border-left:1px solid {BORDER}; }}
        th {{ background:#e8eef5; border-top:1px solid {BORDER}; color:{BLUE}; font-weight:950; }}
        td:first-child {{ color:{BLUE}; font-weight:900; }}
        tr:first-child th:first-child {{ border-top-left-radius:9px; }}
        tr:first-child th:last-child {{ border-top-right-radius:9px; }}
        tr:last-child td:first-child {{ border-bottom-left-radius:9px; }}
        tr:last-child td:last-child {{ border-bottom-right-radius:9px; }}
        .callout {{ border:1px solid #ffd0c8; background:#fff1ef; border-radius:12px; padding:4mm; margin:4mm 0 6mm; break-inside:avoid; }}
        .callout strong {{ color:{ORANGE}; }}
        .step {{ break-inside:avoid; margin:0 0 8mm; page-break-inside:avoid; }}
        .step img {{ width:100%; border:1px solid {BORDER}; border-radius:12px; display:block; margin-top:3mm; box-shadow:0 3px 14px rgba(7,27,68,.10); }}
        .checklist {{ columns:2; column-gap:8mm; margin-top:3mm; }}
        .checklist li {{ break-inside:avoid; margin-bottom:2mm; }}
      </style>
    </head>
    <body>
      <section class="cover">
        <img src="file:///{logo}" alt="Cacarejar" />
        <p class="eyebrow">Manual do usuário com exemplo prático</p>
        <h1>Como usar o Cacarejar do diagnóstico ao acompanhamento</h1>
        <p class="sub">Passo a passo visual usando o NoSeuTempo como cliente modelo.</p>
        <div class="cover-card"><p><strong>Objetivo do manual:</strong> mostrar como um usuário preenche os canais, interpreta o diagnóstico, ensina o Radar, aprova posts, acompanha métricas e recalcula a rota.</p></div>
        <div class="meta"><div>Exemplo</div><div>NoSeuTempo</div><div>Versão</div><div>1.0</div><div>Data</div><div>Junho de 2026</div></div>
      </section>
      <section class="intro">
        <h2>História exemplo</h2>
        <p>O NoSeuTempo é uma plataforma de aprendizagem adaptativa para pessoas neurodivergentes. A jornada abaixo simula um usuário usando o Cacarejar para transformar canais digitais, Radar de Mercado e feedbacks em conteúdo, campanha e aprendizado.</p>
        <table>
          <tr><th>Entrada</th><th>Exemplo usado no manual</th></tr>
          <tr><td>Instagram/TikTok</td><td>@noseutempo</td></tr>
          <tr><td>LinkedIn</td><td>linkedin.com/company/noseutempo</td></tr>
          <tr><td>Site</td><td>noseutempo.com.br</td></tr>
          <tr><td>Produto</td><td>Plataforma de aprendizagem adaptativa com suporte da Geni IA.</td></tr>
          <tr><td>Objetivo</td><td>Gerar leads, criar autoridade e validar narrativa para famílias, escolas e parceiros.</td></tr>
        </table>
        <div class="callout"><strong>Como pensar o fluxo:</strong> Diagnóstico cria a estratégia. Radar traz evidência de mercado. Aprovação transforma isso em execução. Métricas e Acompanhamento fecham o ciclo para melhorar a próxima decisão.</div>
      </section>
      {shot_html}
      <section class="intro">
        <h2>Checklist para repetir com outro cliente</h2>
        <ul class="checklist">
          <li>Preencher todos os canais disponíveis.</li>
          <li>Confirmar se o perfil ativo é o cliente correto.</li>
          <li>Ler o parecer antes de gerar posts.</li>
          <li>Atualizar o Radar para o nicho certo.</li>
          <li>Marcar Gostei/Não gostei em posts, não só em perfis.</li>
          <li>Usar feedbacks do Radar no Diagnóstico.</li>
          <li>Editar/regerar posts antes de aprovar.</li>
          <li>Definir verba diária conscientemente.</li>
          <li>Checar métricas antes de escalar.</li>
          <li>Registrar check-in e recalcular a rota.</li>
        </ul>
      </section>
    </body></html>
    """), encoding="utf-8")


def build_docx():
    doc = Document()
    sec = doc.sections[0]
    sec.top_margin = Inches(0.7)
    sec.bottom_margin = Inches(0.7)
    sec.left_margin = Inches(0.75)
    sec.right_margin = Inches(0.75)
    styles = doc.styles
    styles["Normal"].font.name = "Calibri"
    styles["Normal"].font.size = Pt(10.5)
    styles["Normal"].font.color.rgb = RGBColor.from_string("22304B")
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    logo = ASSETS / "logo-dark.png"
    if logo.exists():
      p.add_run().add_picture(str(logo), width=Inches(2.2))
    doc.add_paragraph("Manual do usuário com exemplo NoSeuTempo").runs[0].bold = True
    doc.add_heading("Como usar o Cacarejar do diagnóstico ao acompanhamento", 0)
    doc.add_paragraph("Este documento mostra o fluxo da plataforma usando o NoSeuTempo como cliente modelo.")
    for name, title in [
        ("01-diagnostico-preenchido.png", "1. Preencher o diagnóstico"),
        ("02-diagnostico-resultado.png", "2. Ler o parecer e a prescrição"),
        ("03-visao-360.png", "3. Explorar a Visão 360"),
        ("04-radar-feedback.png", "4. Ensinar o Radar com feedbacks"),
        ("05-aprovacao-posts.png", "5. Aprovar posts e verba"),
        ("06-campanhas-metricas.png", "6. Ler campanhas e métricas"),
        ("07-acompanhamento.png", "7. Registrar evolução"),
    ]:
        doc.add_heading(title, level=1)
        doc.add_picture(str(SCREENS / name), width=Inches(6.6))
    doc.save(DOCX)


def build_pdf():
    url = "file:///" + HTML.as_posix()
    subprocess.run([
        str(CHROME),
        "--headless",
        "--disable-gpu",
        "--allow-file-access-from-files",
        f"--print-to-pdf={PDF}",
        url,
    ], check=True)


def main():
    MANUALS.mkdir(parents=True, exist_ok=True)
    write_and_capture_screens()
    build_manual_html()
    build_docx()
    build_pdf()
    print(PDF)
    print(DOCX)


if __name__ == "__main__":
    main()
