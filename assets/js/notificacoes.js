// assets/js/notificacoes.js
(async () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.log('Notificações não suportadas');
    return;
  }

  // Solicitar permissão
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('Permissão negada');
    return;
  }

  // Registrar service worker
  const registration = await navigator.serviceWorker.register('/service-worker.js');
  console.log('Service Worker registrado');

  // Elemento de áudio pré-carregado
  const audio = new Audio('/assets/notification.mp3');
  audio.load(); // pré-carrega para tocar mais rápido

  // Variáveis de controle
  let ultimoTicketAbertoId = null;
  let ultimoTicketConcluidoId = null;

  // Função para tocar som
  function tocarSom() {
    // Política de autoplay: precisa de interação do usuário primeiro
    // Mas como o usuário já interagiu com o site (login/cliques), deve funcionar
    audio.play().catch(e => console.log('Autoplay bloqueado:', e));
  }

  // Escutar mensagens do service worker (para tocar som)
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'play-sound') {
      tocarSom();
    }
  });

  // Função de polling para verificar novos tickets
  async function verificarNotificacoes() {
    const user = firebase.auth().currentUser;
    if (!user) return;

    // Buscar perfil do usuário
    const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
    const userTipo = userDoc.data().tipo;

    // Verificar novos tickets abertos (para admins/superadmins)
    if (userTipo === 'admin' || userTipo === 'super_admin') {
      const abertosSnap = await firebase.firestore()
        .collection('tickets')
        .where('status', '==', 'aberto')
        .orderBy('criadoEm', 'desc')
        .limit(1)
        .get();

      if (!abertosSnap.empty) {
        const ticket = abertosSnap.docs[0];
        if (ticket.id !== ultimoTicketAbertoId) {
          ultimoTicketAbertoId = ticket.id;

          // Exibir notificação
          registration.showNotification('🎫 Novo Ticket Aberto', {
            body: `Ticket #${ticket.id.slice(0,6)} - ${ticket.data().problema.substring(0,50)}...`,
            icon: '/assets/icons/icon-192x192.png'
          });

          // Tocar som (via service worker)
          navigator.serviceWorker.controller.postMessage({
            type: 'play-sound',
            sound: 'notification'
          });
        }
      }
    }

    // Verificar tickets concluídos (para o criador)
    const concluidosSnap = await firebase.firestore()
      .collection('tickets')
      .where('status', '==', 'concluido')
      .where('criadoPor', '==', user.uid)
      .orderBy('concluidoEm', 'desc')
      .limit(1)
      .get();

    if (!concluidosSnap.empty) {
      const ticket = concluidosSnap.docs[0];
      if (ticket.id !== ultimoTicketConcluidoId) {
        ultimoTicketConcluidoId = ticket.id;

        registration.showNotification('✅ Ticket Concluído', {
          body: `Seu ticket #${ticket.id.slice(0,6)} foi resolvido.`,
          icon: '/assets/icons/icon-192x192.png'
        });

        // Tocar som
        navigator.serviceWorker.controller.postMessage({
          type: 'play-sound',
          sound: 'notification'
        });
      }
    }
  }

  // Iniciar polling a cada 15 segundos
  setInterval(verificarNotificacoes, 15000);
})();
