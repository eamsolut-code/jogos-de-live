// Converte os eventos brutos do TikTok nas mensagens simples que os jogos entendem.
// Fica separado do servidor para poder ser testado com eventos de exemplo (ver test/).
//
// A biblioteca do TikTok já entregou campos com nomes diferentes conforme a versão,
// por isso cada campo aceita mais de um formato.

const uidOf = (u) => String(u?.displayId || u?.uniqueId || u?.id || 'anon');
const nickOf = (u) => String(u?.nickname || u?.displayId || u?.uniqueId || 'anon');

function mapChat(d) {
  const text = String(d?.content ?? d?.comment ?? '').trim();
  if (!text) return null;
  return { t: 'chat', user: uidOf(d.user), nick: nickOf(d.user), text };
}

// Presentes em sequência: só vale quando a sequência termina (repeatEnd).
function mapGift(d) {
  const type = d?.gift?.type ?? d?.giftDetails?.giftType;
  if (type === 1 && !d.repeatEnd) return null;
  const unit = d?.gift?.diamondCount ?? d?.giftDetails?.diamondCount ?? 1;
  const count = d?.repeatCount || 1;
  const name = d?.gift?.name || d?.giftDetails?.giftName || 'Presente';
  return { t: 'gift', user: uidOf(d.user), nick: nickOf(d.user), name, coins: unit * count, count };
}

function mapLike(d) {
  return { t: 'like', user: uidOf(d?.user), nick: nickOf(d?.user), count: d?.likeCount || d?.count || 1 };
}

module.exports = { uidOf, nickOf, mapChat, mapGift, mapLike };
