// assets/js/notificacoes.js
(async () => {
  console.log('Iniciando script de notificações');

  // Verifica suporte
  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.log('Notificações não suportadas');
    return;
  }

  // Aguarda o Firebase Auth estar pronto
  firebase.auth().onAuthStateChanged(async (user) => {
    console.log('Auth state changed, user:', user ? user.email : 'null');
    if (!user) {
      console.log('Usuário não logado – notificações desativadas');
      return;
    }

    // Solicita permissão se necessário
    if (Notification.permission === 'default') {
      console.log('Solicitando permissão...');
      const permission = await Notification.requestPermission();
      console.log('Permissão:', permission);
      if (permission !== 'granted') {
        console.log('Permissão negada');
        return;
      }
    } else if (Notification.permission === 'denied') {
      console.log('Permissão bloqueada pelo usuário');
      return;
    } else {
      console.log('Permissão já concedida');
    }

    // Registrar Service Worker
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js');
      console.log('Service Worker registrado com sucesso');

      // Elemento de áudio
      const audio = new Audio('/assets/notification.mp3');
      audio.load();
      console.log('Áudio carregado');

      // Variáveis para controle de tickets já notificados
      let ultimoTicketAbertoId = null;
      let ultimoTicketConcluidoId = null;

      // Função para tocar som
      function tocarSom() {
        console.log('Tentando tocar som');
        audio.play().then(() => {
          console.log('Som tocado');
        }).catch(e => {
          console.log('Erro ao tocar som (autoplay bloqueado?):', e);
        });
      }

      // Função de polling
      async function verificarNotificacoes() {
        console.log('Verificando notificações...');
        const user = firebase.auth().currentUser;
        if (!user) return;

        const userDoc = await firebase.firestore().collection('users').doc(user.uid).get();
        if (!userDoc.exists) return;
        const userTipo = userDoc.data().tipo;

        // Verificar novos tickets abertos (para admins)
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
              console.log('Novo ticket aberto detectado:', ticket.id);

              // Mostrar notificação
              registration.showNotification('🎫 Novo Ticket Aberto', {
                body: `Ticket #${ticket.id.slice(0,6)} - ${ticket.data().problema.substring(0,50)}...`,
                icon: '/assets/icons/icon-192x192.png'
              });

              // Tocar som
              tocarSom();
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
            console.log('Ticket concluído detectado:', ticket.id);

            registration.showNotification('✅ Ticket Concluído', {
              body: `Seu ticket #${ticket.id.slice(0,6)} foi resolvido.`,
              icon: '/assets/icons/icon-192x192.png'
            });

            tocarSom();
          }
        }
      }

      // Iniciar polling a cada 15 segundos
      setInterval(verificarNotificacoes, 5000);
      // Chamar uma vez imediatamente
      verificarNotificacoes();

    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
    }
  });
})();
