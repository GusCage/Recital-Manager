const SUPABASE_URL = "https://cmzyxgksiftediaionih.supabase.co";
const SUPABASE_KEY = "sb_publishable_P7c8F1Xxw9v6PViH6UM2zQ_qlPpfE2Z";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const form = document.getElementById("musicForm");
const tableBody = document.getElementById("musicTableBody");
const searchInput = document.getElementById("searchInput");

let musicas = [];
let editandoId = null;
let carregando = false;

// Protege os textos exibidos na tabela.
function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caractere]);
}

// Converte segundos para minutos:segundos.
function formatarDuracao(segundos) {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;

  return `${minutos}:${String(resto).padStart(2, "0")}`;
}

// Converte os nomes das colunas do Supabase
// para os nomes utilizados pelo formulário.
function converterMusica(m) {
  return {
    id: String(m.id),
    aluno: m.nome_aluno,
    professor: m.professor,
    musica: m.nome_musica,
    artista: m.artista || "",
    instrumento: m.instrumento,
    genero: m.genero,
    tom: m.tom || "",
    duracao: m.duracao_segundos,
    observacoes: m.observacoes || ""
  };
}

// Busca os registros no banco de dados.
async function carregarMusicas() {
  carregando = true;
  renderizarMusicas();

  const { data, error } = await supabaseClient
    .from("musicas")
    .select("*")
    .order("id", { ascending: true });

  carregando = false;

  if (error) {
    console.error("Erro ao carregar músicas:", error);
    renderizarMusicas();
    alert("Erro ao carregar músicas. Confira a conexão e as permissões do Supabase.");
    return;
  }

  musicas = data.map(converterMusica);
  renderizarMusicas();
}

// Atualiza a tabela e os contadores na tela.
function renderizarMusicas() {
  const busca = searchInput.value.trim().toLowerCase();

  const filtradas = musicas.filter(m => {
    const texto = [
      m.aluno,
      m.professor,
      m.musica,
      m.artista,
      m.instrumento,
      m.genero,
      m.tom
    ].join(" ").toLowerCase();

    return texto.includes(busca);
  });

  document.getElementById("totalMusicas").textContent =
    musicas.length;

  const alunosUnicos = new Set(
    musicas.map(m => m.aluno.trim().toLowerCase())
  );

  document.getElementById("totalAlunos").textContent =
    alunosUnicos.size;

  const emptyState = document.getElementById("emptyState");
  const titulo = document.querySelector("#emptyState h3");
  const descricao = document.querySelector("#emptyState p");

  if (carregando) {
    emptyState.hidden = false;
    titulo.textContent = "Carregando músicas...";
    descricao.textContent = "Buscando os registros no banco de dados.";
  } else if (filtradas.length === 0) {
    emptyState.hidden = false;

    if (musicas.length === 0) {
      titulo.textContent = "Nenhuma música cadastrada";
      descricao.textContent =
        "Use o formulário acima para adicionar a primeira apresentação.";
    } else {
      titulo.textContent = "Nenhum resultado encontrado";
      descricao.textContent =
        "Tente pesquisar por outro nome ou gênero.";
    }
  } else {
    emptyState.hidden = true;
  }

  document.getElementById("tableWrapper").hidden =
    carregando || filtradas.length === 0;

  tableBody.innerHTML = filtradas.map(m => `
    <tr>
      <td>
        <div class="song-title">${escaparHTML(m.aluno)}</div>
        <div>${escaparHTML(m.musica)}</div>
        <div class="song-subtitle">
          ${escaparHTML(m.artista || "Artista não informado")}
        </div>
      </td>
      <td>${escaparHTML(m.instrumento)}</td>
      <td><span class="genre-tag">${escaparHTML(m.genero)}</span></td>
      <td>${escaparHTML(m.tom || "—")}</td>
      <td>${formatarDuracao(m.duracao)}</td>
      <td>
        <div class="action-group">
          <button class="action-button"
            data-action="editar" data-id="${escaparHTML(m.id)}">
            Editar
          </button>
          <button class="action-button action-delete"
            data-action="excluir" data-id="${escaparHTML(m.id)}">
            Excluir
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  document.getElementById("resultCount").textContent =
    carregando
      ? "Carregando..."
      : `${filtradas.length} de ${musicas.length} música(s)`;
}

// Limpa o formulário e encerra o modo de edição.
function limparFormulario() {
  form.reset();
  editandoId = null;

  document.getElementById("formTitle").textContent =
    "Nova apresentação";

  document.getElementById("submitButton").textContent =
    "+ Cadastrar música";

  document.getElementById("cancelEdit").hidden = true;
}

// Cadastra uma música ou salva alterações no banco.
form.addEventListener("submit", async event => {
  event.preventDefault();

  const minutos = Number(document.getElementById("minutos").value);
  const segundos = Number(document.getElementById("segundos").value);

  if (
    !Number.isInteger(minutos) ||
    minutos < 0 ||
    minutos > 300 ||
    !Number.isInteger(segundos) ||
    segundos < 0 ||
    segundos > 59
  ) {
    alert("Confira a duração da música.");
    return;
  }

  const duracao = minutos * 60 + segundos;

  if (duracao <= 0) {
    alert("A duração precisa ser maior que zero.");
    return;
  }

  // Os nomes abaixo correspondem às colunas da tabela SQL.
  const dados = {
    nome_aluno: document.getElementById("aluno").value.trim(),
    professor: document.getElementById("professor").value.trim(),
    nome_musica: document.getElementById("musica").value.trim(),
    artista: document.getElementById("artista").value.trim() || null,
    instrumento: document.getElementById("instrumento").value,
    genero: document.getElementById("genero").value,
    tom: document.getElementById("tom").value.trim() || null,
    duracao_segundos: duracao,
    observacoes:
      document.getElementById("observacoes").value.trim() || null
  };

  const botao = document.getElementById("submitButton");
  botao.disabled = true;

  try {
    let resultado;

    if (editandoId !== null) {
      resultado = await supabaseClient
        .from("musicas")
        .update(dados)
        .eq("id", editandoId);
    } else {
      resultado = await supabaseClient
        .from("musicas")
        .insert([dados]);
    }

    if (resultado.error) {
      throw resultado.error;
    }

    limparFormulario();
    await carregarMusicas();

  } catch (error) {
    console.error("Erro ao salvar música:", error);
    alert("Não foi possível salvar a música. Confira o console e as permissões do Supabase.");
  } finally {
    botao.disabled = false;
  }
});

// Trata os botões de editar e excluir.
tableBody.addEventListener("click", async event => {
  const botao = event.target.closest("button[data-action]");

  if (!botao) return;

  const id = botao.dataset.id;
  const acao = botao.dataset.action;
  const musica = musicas.find(m => m.id === id);

  if (!musica) return;

  if (acao === "editar") {
    editandoId = id;

    for (const campo of [
      "aluno",
      "professor",
      "musica",
      "artista",
      "instrumento",
      "genero",
      "tom",
      "observacoes"
    ]) {
      document.getElementById(campo).value = musica[campo] || "";
    }

    document.getElementById("minutos").value =
      Math.floor(musica.duracao / 60);

    document.getElementById("segundos").value =
      musica.duracao % 60;

    document.getElementById("formTitle").textContent =
      "Editar apresentação";

    document.getElementById("submitButton").textContent =
      "Salvar alterações";

    document.getElementById("cancelEdit").hidden = false;

    form.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (acao === "excluir") {
    const confirmar = confirm(
      `Deseja excluir a música "${musica.musica}" de ${musica.aluno}?`
    );

    if (!confirmar) return;

    botao.disabled = true;

    try {
      const { error } = await supabaseClient
        .from("musicas")
        .delete()
        .eq("id", id);

      if (error) throw error;

      if (editandoId === id) {
        limparFormulario();
      }

      await carregarMusicas();

    } catch (error) {
      console.error("Erro ao excluir música:", error);
      alert("Não foi possível excluir a música. Confira as permissões do Supabase.");
    } finally {
      botao.disabled = false;
    }
  }
});

// Eventos da interface.
document.getElementById("cancelEdit").addEventListener(
  "click",
  limparFormulario
);

searchInput.addEventListener("input", renderizarMusicas);

// Inicia o site buscando os dados online.
carregarMusicas();
