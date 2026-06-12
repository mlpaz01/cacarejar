from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "docs" / "manuals"
DOCX = OUT_DIR / "manual_usuario_cacarejar.docx"
ASSETS = ROOT / "client" / "public" / "assets"

BLUE = "071B44"
ORANGE = "FF3217"
MUTED = "61708A"
LIGHT = "F6F8FC"
BORDER = "DDE5F0"
GREEN = "18B85C"


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color=BORDER, size="8"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right"):
        tag = "w:" + edge
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def set_cell_margins(cell, top=80, start=120, bottom=80, end=120):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for m, v in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{m}"))
        if node is None:
            node = OxmlElement(f"w:{m}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(v))
        node.set(qn("w:type"), "dxa")


def set_table_widths(table, widths):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for row in table.rows:
        for idx, width in enumerate(widths):
            if idx < len(row.cells):
                row.cells[idx].width = width
                set_cell_margins(row.cells[idx])
                set_cell_border(row.cells[idx])
                row.cells[idx].vertical_alignment = WD_ALIGN_VERTICAL.CENTER


def add_run(paragraph, text, bold=False, color=None, size=None, italic=False):
    run = paragraph.add_run(text)
    run.bold = bold
    run.italic = italic
    if color:
        run.font.color.rgb = RGBColor.from_string(color)
    if size:
        run.font.size = Pt(size)
    return run


def add_heading(doc, text, level=1):
    p = doc.add_paragraph()
    p.style = f"Heading {level}"
    p.add_run(text)
    return p


def add_body(doc, text, bold_prefix=None):
    p = doc.add_paragraph()
    p.style = "Body"
    if bold_prefix and text.startswith(bold_prefix):
        add_run(p, bold_prefix, bold=True, color=BLUE)
        add_run(p, text[len(bold_prefix):])
    else:
        p.add_run(text)
    return p


def add_bullet(doc, text):
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(text)
    return p


def add_number(doc, text):
    p = doc.add_paragraph(style="List Number")
    p.add_run(text)
    return p


def add_callout(doc, title, text, fill="F8FAFC", accent=ORANGE):
    table = doc.add_table(rows=1, cols=1)
    set_table_widths(table, [Inches(6.35)])
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    p.style = "Body"
    add_run(p, title, bold=True, color=accent)
    add_run(p, f" {text}", color=BLUE)
    doc.add_paragraph()


def add_info_table(doc, headers, rows, widths=None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.style = "Table Grid"
    if widths:
        set_table_widths(table, widths)
    header = table.rows[0].cells
    for i, h in enumerate(headers):
        set_cell_shading(header[i], "E8EEF5")
        p = header[i].paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        add_run(p, h, bold=True, color=BLUE, size=9.5)
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            p = cells[i].paragraphs[0]
            p.style = "Body"
            add_run(p, str(value), color=BLUE if i == 0 else None, bold=(i == 0), size=9.3)
    if widths:
        set_table_widths(table, widths)
    doc.add_paragraph()
    return table


def add_step_table(doc):
    rows = [
        ("1", "Diagnóstico", "Inserir site, Instagram, TikTok, LinkedIn e contexto do negócio.", "Parecer estratégico, prescrição por canal e cronograma."),
        ("2", "Radar de Mercado", "Pesquisar o que está quente, marcar gostei/não gostei e retroalimentar.", "Ideias e referências reais para melhorar o plano."),
        ("3", "Aprovação", "Revisar posts sugeridos, editar quando necessário e aprovar verba.", "Conteúdos liberados para campanha com orçamento claro."),
        ("4", "Campanhas", "Acompanhar o que foi publicado e quanto está sendo investido.", "Controle operacional da execução."),
        ("5", "Métricas", "Ler CTR, cliques, conversões, CPL e sinais por canal.", "Decisão sobre o que manter, pausar ou escalar."),
        ("6", "Acompanhamento", "Registrar check-ins, evolução e aprendizados da semana.", "Plano recalculado com dados reais."),
    ]
    add_info_table(
        doc,
        ["Etapa", "Tela", "O que o usuário faz", "O que o Cacarejar entrega"],
        rows,
        [Inches(0.55), Inches(1.25), Inches(2.5), Inches(2.05)],
    )


def add_agent_grid(doc):
    rows = [
        ("Agente Estrategista", "Transforma os dados do negócio em diagnóstico, parecer, prescrição e cronograma."),
        ("Agente Radar", "Busca sinais de mercado, posts quentes, padrões vencedores e oportunidades."),
        ("Agente Criativo", "Gera posts, copies, roteiros, direção de arte e imagens editáveis."),
        ("Agente de Mídia", "Organiza aprovação, verba, campanhas, métricas e leitura de performance."),
    ]
    add_info_table(doc, ["Agente", "Função prática"], rows, [Inches(1.85), Inches(4.5)])


def add_cover(doc):
    section = doc.sections[0]
    section.top_margin = Inches(0.7)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(0.78)
    section.right_margin = Inches(0.78)

    logo = ASSETS / "logo-dark.png"
    if logo.exists():
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.add_run().add_picture(str(logo), width=Inches(2.4))

    doc.add_paragraph()
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    add_run(p, "Manual do usuário", bold=True, color=ORANGE, size=14)

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(4)
    add_run(p, "Cacarejar", bold=True, color=BLUE, size=34)

    p = doc.add_paragraph()
    add_run(p, "Fluxo de uso, funcionalidades e boas práticas para transformar diagnóstico em execução, campanha e aprendizado.", color=BLUE, size=15)

    doc.add_paragraph()
    add_callout(
        doc,
        "Resumo:",
        "o Cacarejar organiza a jornada em seis momentos: Diagnóstico, Radar de Mercado, Aprovação, Campanhas, Métricas e Acompanhamento.",
        fill="FFF1EF",
        accent=ORANGE,
    )

    meta = doc.add_table(rows=3, cols=2)
    set_table_widths(meta, [Inches(1.7), Inches(4.65)])
    for label, value in [
        ("Versão", "1.0"),
        ("Data", "Junho de 2026"),
        ("Público", "Usuários, administradores, sócios e novos operadores da plataforma"),
    ]:
        row = meta.rows[len([r for r in meta.rows if r.cells[0].text]) - 1] if False else None
    for i, (label, value) in enumerate([
        ("Versão", "1.0"),
        ("Data", "Junho de 2026"),
        ("Público", "Usuários, administradores, sócios e novos operadores da plataforma"),
    ]):
        cells = meta.rows[i].cells
        set_cell_shading(cells[0], "E8EEF5")
        cells[0].paragraphs[0].add_run(label).bold = True
        cells[1].paragraphs[0].add_run(value)
    doc.add_page_break()


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor.from_string("22304B")
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    if "Body" not in styles:
        styles.add_style("Body", 1)
    body = styles["Body"]
    body.base_style = normal
    body.font.name = "Calibri"
    body.font.size = Pt(10.5)
    body.font.color.rgb = RGBColor.from_string("22304B")
    body.paragraph_format.space_after = Pt(6)
    body.paragraph_format.line_spacing = 1.25

    for name, size, color, before, after in [
        ("Heading 1", 16, "2E74B5", 18, 10),
        ("Heading 2", 13, "2E74B5", 14, 7),
        ("Heading 3", 12, "1F4D78", 10, 5),
    ]:
        st = styles[name]
        st.font.name = "Calibri"
        st.font.size = Pt(size)
        st.font.bold = True
        st.font.color.rgb = RGBColor.from_string(color)
        st.paragraph_format.space_before = Pt(before)
        st.paragraph_format.space_after = Pt(after)
        st.paragraph_format.keep_with_next = True

    for name in ("List Bullet", "List Number"):
        st = styles[name]
        st.font.name = "Calibri"
        st.font.size = Pt(10.5)
        st.font.color.rgb = RGBColor.from_string("22304B")
        st.paragraph_format.left_indent = Inches(0.375)
        st.paragraph_format.first_line_indent = Inches(-0.188)
        st.paragraph_format.space_after = Pt(4)
        st.paragraph_format.line_spacing = 1.25


def add_footer(doc):
    for section in doc.sections:
        footer = section.footer.paragraphs[0]
        footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        footer.add_run("Cacarejar • Manual do usuário").font.size = Pt(8)
        footer.runs[0].font.color.rgb = RGBColor.from_string(MUTED)


def build():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    doc = Document()
    configure_styles(doc)
    add_cover(doc)

    add_heading(doc, "1. Visão geral da jornada", 1)
    add_body(doc, "O Cacarejar foi desenhado para reduzir passos: primeiro ele entende o negócio, depois encontra sinais de mercado, transforma isso em conteúdo editável, organiza aprovação, acompanha campanhas e usa os resultados para recalcular a rota.")
    add_step_table(doc)
    add_callout(doc, "Regra de ouro:", "não trate as telas como módulos soltos. O valor aparece quando o diagnóstico, o Radar, os feedbacks, a aprovação e as métricas conversam entre si.", fill="F8FAFC")

    add_heading(doc, "2. Papéis dos Agentes", 1)
    add_body(doc, "A plataforma usa o termo Agentes porque cada área tem uma responsabilidade clara na jornada. O usuário não precisa dominar marketing técnico; ele precisa orientar, revisar e aprovar as decisões importantes.")
    add_agent_grid(doc)

    add_heading(doc, "3. Diagnóstico", 1)
    add_body(doc, "A tela de Diagnóstico é o ponto de partida. O usuário informa as fontes disponíveis do negócio: site, Instagram, TikTok, LinkedIn e uma descrição do que vende. O resultado combina essas referências para gerar uma leitura estratégica.")
    add_heading(doc, "O que preencher", 2)
    for item in [
        "Instagram, TikTok e LinkedIn quando existirem. Se o LinkedIn for importante para venda B2B, ele deve ser informado.",
        "Site ou página de venda para o Agente entender promessa, produto e autoridade.",
        "Descrição do produto, público e objetivo atual: vender mais, gerar leads, crescer seguidores ou lançar produto.",
        "Contexto opcional: cliente ideal, campanhas que funcionaram, restrições, preço, diferenciais e dúvidas comerciais.",
    ]:
        add_bullet(doc, item)
    add_heading(doc, "Como ler o resultado", 2)
    add_info_table(doc, ["Bloco", "Como usar"], [
        ("Parecer", "Leitura central do negócio: onde há oportunidade, risco e prioridade."),
        ("Prescrição por canal", "O que fazer no LinkedIn, Instagram, TikTok, Google/SEO ou outro canal relevante."),
        ("Visão 360 LinkedIn", "Pessoas, áreas, tecnologias e níveis de conexão úteis para conteúdo e anúncios B2B."),
        ("Interesses pelos posts", "Temas inferidos a partir do Radar e das ideias marcadas."),
        ("Cronograma", "Execução por semana, com ações concretas e metas de aprendizado."),
    ], [Inches(1.65), Inches(4.7)])

    add_heading(doc, "4. Radar de Mercado", 1)
    add_body(doc, "O Radar mostra o que está quente no nicho. Ele não serve apenas para copiar referências; serve para descobrir padrões, dores, formatos e ângulos que podem melhorar o diagnóstico e os conteúdos.")
    add_heading(doc, "Como operar", 2)
    for item in [
        "Abra o Radar a partir do menu ou pelo Diagnóstico.",
        "Se houver diagnóstico ativo, o Radar usa esse perfil como base. Se não houver perfil, informe perfis inspiradores manualmente.",
        "Abra posts para avaliar contexto e marque Gostei ou Não gostei diretamente nos cards.",
        "Use Feedback para refazer a pesquisa quando quiser manter bons sinais e remover referências fracas.",
        "Depois de marcar os sinais úteis, use os feedbacks do Radar no Diagnóstico.",
    ]:
        add_number(doc, item)
    add_callout(doc, "Boa prática:", "marque posts, não apenas influenciadores. A variedade melhora quando o Radar aprende quais conteúdos realmente combinam com a marca.", fill="EAFBF1", accent=GREEN)

    add_heading(doc, "5. Ideias e criativos", 1)
    add_body(doc, "As ideias nascem do cruzamento entre estratégia, Radar e identidade da marca. Elas podem virar posts com imagem, copy, hashtags, CTA e roteiro.")
    add_info_table(doc, ["Ação", "Quando usar"], [
        ("Gerar posts para aprovação", "Quando o diagnóstico já está bom e o usuário quer transformar plano em execução."),
        ("Editar / regerar", "Quando a ideia está certa, mas a imagem, texto, CTA ou formato precisa de ajuste."),
        ("Enviar para aprovação", "Quando o criativo está pronto para virar campanha ou publicação revisada."),
        ("Subir imagem própria", "Quando a marca já tem visual, foto ou peça aprovada internamente."),
    ], [Inches(2.0), Inches(4.35)])

    add_heading(doc, "6. Aprovação", 1)
    add_body(doc, "A aprovação é a última conferência antes de colocar conteúdo e verba em movimento. Ela existe para dar controle ao usuário sem transformar a jornada em burocracia.")
    add_heading(doc, "O que revisar", 2)
    for item in [
        "Imagem ou criativo visual.",
        "Legenda/copy e CTA.",
        "Canal indicado pelo plano.",
        "Origem do post: Diagnóstico, Radar, Estúdio ou conteúdo em teste.",
        "Verba diária e distribuição inicial entre os posts aprovados.",
    ]:
        add_bullet(doc, item)
    add_callout(doc, "Como a verba é pensada:", "no início, os posts aprovados recebem partes equilibradas. Com dados reais, o motor direciona mais verba para vencedores e reduz desperdício nos fracos.", fill="FFF1EF")

    add_heading(doc, "7. Campanhas", 1)
    add_body(doc, "A tela Campanhas é a sala de controle. Ela mostra campanhas ativas, verba usada, saldo planejado e permite acompanhar o que saiu da aprovação.")
    add_info_table(doc, ["Indicador", "Significado"], [
        ("Ativas", "Campanhas que estão rodando ou prontas para execução."),
        ("Verba usada", "Quanto já foi consumido dentro do orçamento planejado."),
        ("Saldo do plano", "Quanto ainda pode ser investido sem estourar o limite definido."),
        ("Status", "Rascunho, ativa, pausada, concluída ou arquivada."),
    ], [Inches(1.55), Inches(4.8)])

    add_heading(doc, "8. Métricas", 1)
    add_body(doc, "Métricas responde à pergunta: o mercado está reagindo? A tela mostra impressões, cliques, conversões, investimento, receita, CTR, CPC e leitura do Agente.")
    add_info_table(doc, ["Métrica", "Como interpretar"], [
        ("Impressões", "Se o público está vendo a campanha."),
        ("CTR", "Se o gancho e a imagem estão chamando atenção."),
        ("Cliques", "Se há interesse suficiente para avançar."),
        ("Conversões", "Se a oferta e o funil estão funcionando."),
        ("CPL / CPC", "Quanto custa gerar oportunidade ou tráfego."),
    ], [Inches(1.35), Inches(5.0)])
    add_callout(doc, "Leitura prática:", "métrica sem ação não muda o negócio. Use a leitura do Agente para decidir se deve trocar criativo, ajustar oferta, pausar, escalar ou recalibrar.", fill="F8FAFC")

    add_heading(doc, "9. Acompanhamento", 1)
    add_body(doc, "Acompanhamento transforma o diagnóstico em planner. O usuário registra o que foi executado, marca itens como feito/a fazer/atrasado e informa aprendizados da semana.")
    add_heading(doc, "Rotina recomendada", 2)
    for item in [
        "Semana 0: gerar diagnóstico e aprovar primeiros posts.",
        "Semana 1: publicar, iniciar campanha e registrar execução.",
        "Semana 2: comparar primeiros sinais e recalcular com evolução.",
        "Semanas seguintes: repetir check-in, preservar vencedores e testar novas hipóteses.",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "10. Fluxo recomendado para um novo cliente", 1)
    add_info_table(doc, ["Momento", "Ação recomendada", "Resultado esperado"], [
        ("Entrada", "Preencher todos os canais disponíveis e objetivo comercial.", "Diagnóstico rico e menos genérico."),
        ("Leitura", "Ler parecer, prescrição por canal e cronograma.", "Clareza sobre prioridade."),
        ("Mercado", "Rodar Radar, marcar feedbacks e recalcular.", "Plano mais conectado ao que está funcionando agora."),
        ("Conteúdo", "Gerar posts, editar detalhes e mandar para aprovação.", "Peças prontas para execução."),
        ("Mídia", "Aprovar verba e iniciar campanha.", "Teste controlado, com critério."),
        ("Aprendizado", "Checar métricas e registrar evolução.", "Próximo plano baseado em dados reais."),
    ], [Inches(1.25), Inches(3.0), Inches(2.1)])

    add_heading(doc, "11. Checklist rápido", 1)
    for item in [
        "O perfil correto está ativo no Diagnóstico?",
        "As fontes do negócio estão preenchidas: site, LinkedIn, Instagram, TikTok e contexto?",
        "O Radar foi atualizado para o nicho certo?",
        "Os posts relevantes foram marcados com Gostei e os fracos com Não gostei?",
        "Os feedbacks do Radar foram usados no Diagnóstico?",
        "Os posts gerados foram revisados e enviados para Aprovação?",
        "A verba diária foi definida conscientemente?",
        "As métricas foram usadas no Acompanhamento antes de recalcular a rota?",
    ]:
        add_bullet(doc, item)

    add_heading(doc, "12. Perguntas frequentes", 1)
    add_info_table(doc, ["Pergunta", "Resposta"], [
        ("Posso usar só um canal?", "Sim. Mas o diagnóstico fica melhor quando cruza várias fontes."),
        ("Por que marcar Gostei/Não gostei?", "Porque o Agente aprende preferências reais do usuário e melhora a próxima rodada."),
        ("O Radar substitui o diagnóstico?", "Não. Ele alimenta o diagnóstico com sinais de mercado."),
        ("Aprovação é obrigatória?", "Ela é recomendada para controlar conteúdo, marca e verba antes de campanha."),
        ("Quando recalcular?", "Depois de feedbacks importantes, nova pesquisa de Radar ou primeira leitura de métricas."),
    ], [Inches(2.0), Inches(4.35)])

    add_footer(doc)
    doc.save(DOCX)
    print(DOCX)


if __name__ == "__main__":
    build()
