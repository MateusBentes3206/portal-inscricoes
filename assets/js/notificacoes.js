// assets/js/notificacoes.js
(() => {
  'use strict';

  // Verifica suporte do navegador
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.log('❌ Notificações não suportadas');
    return;
  }

  // Chave para localStorage
  const STORAGE_KEY_ABERTOS = 'notificadosAbertos';
  const STORAGE_KEY_CONCLUIDOS = 'notificadosConcluidos';

  // Carrega conjuntos do localStorage
  function carregarNotificados() {
    const abertos = new Set();
    const concluidos = new Set();
    try {
      const savedAbertos = localStorage.getItem(STORAGE_KEY_ABERTOS);
      if (savedAbertos) {
        JSON.parse(savedAbertos).forEach(id => abertos.add(id));
      }
      const savedConcluidos = localStorage.getItem(STORAGE_KEY_CONCLUIDOS);
      if (savedConcluidos) {
        JSON.parse(savedConcluidos).forEach(id => concluidos.add(id));
      }
    } catch (e) {
      console.warn('Erro ao carregar notificados do localStorage', e);
    }
    return { abertos, concluidos };
  }

  // Salva conjuntos no localStorage
  function salvarNotificados(abertos, concluidos) {
    try {
      localStorage.setItem(STORAGE_KEY_ABERTOS, JSON.stringify(Array.from(abertos)));
      localStorage.setItem(STORAGE_KEY_CONCLUIDOS, JSON.stringify(Array.from(concluidos)));
    } catch (e) {
      console.warn('Erro ao salvar notificados', e);
    }
  }

  // Carrega estado inicial
  let { abertos: notificadosAbertos, concluidos: notificadosConcluidos } = carregarNotificados();

  // Elemento de áudio (pré-carregado)
  const audio = new Audio('/assets/notification.mp3');
  audio.load();

  // Função para tocar som (com tratamento de autoplay)
  function tocarSom() {
    audio.play().catch(e => console.log('⚠️ Autoplay bloqueado:', e));
  }

  // Função principal de verificação
  async function verificarNotificacoes(user) {
    if (!user) return;
    console.log('🔍 Verificando notificações...');

    const db = firebase.firestore();

    // ========== 1. Verificar novos tickets ABERTOS (para admins) ==========
    // Busca o tipo do usuário
    const userDoc = await db.collection('users').doc(user.uid).get();
    const userTipo = userDoc.data()?.tipo;

    if (userTipo === 'admin' || userTipo === 'super_admin') {
      const abertosSnap = await db.collection('tickets')
        .where('status', '==', 'aberto')
        .orderBy('criadoEm', 'desc')
        .limit(5) // busca os últimos 5 para evitar muitas leituras
        .get();

      abertosSnap.forEach(doc => {
        const ticketId = doc.id;

        // Se ainda não notificamos este ticket
        if (!notificadosAbertos.has(ticketId)) {
          notificadosAbertos.add(ticketId);

          // Exibe notificação
          new Notification('🎫 Novo Ticket Aberto', {
            body: `Ticket #${ticketId.slice(0,6)} - ${doc.data().problema.substring(0,50)}...`,
            icon: '/assets/icons/icon-192x192.png', // opcional
            silent: false
          });

          // Toca o som
          tocarSom();

          console.log('🔔 Notificação de abertura enviada', ticketId);
        }
      });
    }

    // ========== 2. Verificar tickets CONCLUÍDOS (para o criador) ==========
    const concluidosSnap = await db.collection('tickets')
      .where('status', '==', 'concluido')
      .where('criadoPor', '==', user.uid)
      .orderBy('concluidoEm', 'desc')
      .limit(5)
      .get();

    concluidosSnap.forEach(doc => {
      const ticketId = doc.id;

      if (!notificadosConcluidos.has(ticketId)) {
        notificadosConcluidos.add(ticketId);

        new Notification('✅ Ticket Concluído', {
          body: `Seu ticket #${ticketId.slice(0,6)} foi resolvido.`,
          icon: '/assets/icons/icon-192x192.png',
          silent: false
        });

        tocarSom();

        console.log('🔔 Notificação de conclusão enviada', ticketId);
      }
    });

    // Salva os conjuntos atualizados no localStorage
    salvarNotificados(notificadosAbertos, notificadosConcluidos);
  }

  // ========== Inicialização do sistema ==========
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      console.log('👤 Usuário não logado – notificações desativadas');
      return;
    }

    console.log('👤 Usuário logado – iniciando notificações');

    // Solicitar permissão se necessário
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('❌ Permissão negada');
        return;
      }
    }

    // Registrar Service Worker (se ainda não registrado)
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('✅ Service Worker registrado', registration);
    } catch (err) {
      console.error('❌ Erro ao registrar Service Worker:', err);
    }

    // Iniciar polling a cada 30 segundos
    setInterval(() => verificarNotificacoes(user), 30000);

    // Executar uma verificação imediata
    verificarNotificacoes(user);
  });
})();