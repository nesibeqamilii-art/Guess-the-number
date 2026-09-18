/* Replace these two values with your project's values from Supabase > Project Settings > API. */
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

const { createClient } = window.supabase;
const state = { client: null, room: null, playerSlot: null, channel: null };
const $ = (id) => document.getElementById(id);

function randomCode() {
  return Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
}
function randomNumber() { return Math.floor(Math.random() * 21); }
function showError(message) { $('connection-error').textContent = message; $('connection-error').classList.remove('hidden'); }
function clearError() { $('connection-error').classList.add('hidden'); }
function setFeedback(message, tone = 'normal') { $('feedback').textContent = message; $('feedback').style.color = tone === 'win' ? '#d65032' : tone === 'hint' ? '#4b7f32' : ''; }
function setStatus(message) { $('status-text').textContent = message; }

function configured() {
  return SUPABASE_URL.startsWith('http') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
}

function renderRoom(room) {
  state.room = room;
  $('active-room-code').textContent = room.room_code;
  $('round-number').textContent = room.round_number || 1;
  $('player1-name').textContent = room.player1_name || 'Waiting…';
  $('player2-name').textContent = room.player2_name || 'Waiting…';
  $('player1-score').textContent = room.player1_score ?? 0;
  $('player2-score').textContent = room.player2_score ?? 0;
  $('player1-card').style.background = state.playerSlot === 1 ? '#efffd0' : '';
  $('player2-card').style.background = state.playerSlot === 2 ? '#efffd0' : '';
  const ready = Boolean(room.player1_name && room.player2_name);
  $('guess').disabled = !ready;
  $('guess-button').disabled = !ready;
  if (!ready) setFeedback('Waiting for a second player to join…');
  else setStatus('Both players are in. Make your guess.');
}

async function fetchRoom(code) {
  const { data, error } = await state.client.from('rooms').select('*').eq('room_code', code).maybeSingle();
  if (error) throw error;
  return data;
}

async function joinRoom(event) {
  event.preventDefault();
  clearError();
  if (!configured()) {
    showError('Add your Supabase URL and anon key in app.js before joining a room.');
    return;
  }
  const name = $('name').value.trim();
  const code = $('room-code').value.trim().toUpperCase();
  if (!name || !code) return;
  const submit = event.submitter;
  submit.disabled = true;
  try {
    let room = await fetchRoom(code);
    if (!room) {
      const { data, error } = await state.client.from('rooms').insert({
        room_code: code, player1_name: name, secret_number: randomNumber(), player1_score: 0, player2_score: 0,
      }).select().single();
      if (error) throw error;
      room = data;
      state.playerSlot = 1;
    } else if (room.player1_name === name) {
      state.playerSlot = 1;
    } else if (room.player2_name === name) {
      state.playerSlot = 2;
    } else if (!room.player2_name) {
      const { data, error } = await state.client.from('rooms').update({ player2_name: name }).eq('id', room.id).is('player2_name', null).select().maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Another player joined this room first. Please choose a different room.');
      room = data;
      state.playerSlot = 2;
    } else {
      throw new Error('This room already has two players. Choose another room code.');
    }
    sessionStorage.setItem(`guess-number:${code}`, JSON.stringify({ name, playerSlot: state.playerSlot }));
    $('lobby').classList.add('hidden');
    $('game').classList.remove('hidden');
    renderRoom(room);
    subscribe(code);
  } catch (error) {
    showError(error.message || 'Could not join this room.');
  } finally { submit.disabled = false; }
}

function subscribe(code) {
  state.channel?.unsubscribe();
  state.channel = state.client.channel(`room:${code}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `room_code=eq.${code}` }, (payload) => {
      const before = state.room;
      renderRoom(payload.new);
      if (before && payload.new.round_number > before.round_number) {
        const winner = payload.new.last_winner || 'A player';
        setFeedback(`${winner} got it! A new round has started.`, 'win');
      }
    })
    .subscribe((status) => setStatus(status === 'SUBSCRIBED' ? 'Live connection ready.' : `Room connection: ${status.toLowerCase()}`));
}

async function makeGuess(event) {
  event.preventDefault();
  const guess = Number($('guess').value);
  if (!Number.isInteger(guess) || guess < 0 || guess > 20 || !state.room) { setFeedback('Enter a whole number from 0 to 20.', 'win'); return; }
  if (!state.room.player2_name) return;
  if (guess < state.room.secret_number) { setFeedback('Too low — try a higher number.', 'hint'); return; }
  if (guess > state.room.secret_number) { setFeedback('Too high — try a lower number.', 'hint'); return; }

  const winner = state.playerSlot === 1 ? state.room.player1_name : state.room.player2_name;
  const scoreColumn = state.playerSlot === 1 ? 'player1_score' : 'player2_score';
  $('guess-button').disabled = true;
  try {
    const updates = { secret_number: randomNumber(), round_number: (state.room.round_number || 1) + 1, last_winner: winner, [scoreColumn]: (state.room[scoreColumn] || 0) + 1 };
    const { data, error } = await state.client.from('rooms').update(updates)
      .eq('id', state.room.id).eq('secret_number', state.room.secret_number).select().maybeSingle();
    if (error) throw error;
    if (!data) { setFeedback('Your opponent won that round first. New round underway!', 'win'); await refreshRoom(); return; }
    renderRoom(data);
    setFeedback('Correct! You earn a point. Next round is live.', 'win');
    $('guess').value = '';
  } catch (error) { showError(error.message || 'Your guess could not be submitted.'); }
  finally { $('guess-button').disabled = false; }
}

async function refreshRoom() { try { renderRoom(await fetchRoom(state.room.room_code)); } catch (_) { /* subscription will retry */ } }
function leaveRoom() { state.channel?.unsubscribe(); state = Object.assign(state, { room: null, playerSlot: null, channel: null }); $('game').classList.add('hidden'); $('lobby').classList.remove('hidden'); $('guess-form').reset(); setFeedback(''); }

function init() {
  $('room-code').value = randomCode();
  $('random-room').addEventListener('click', () => { $('room-code').value = randomCode(); });
  $('join-form').addEventListener('submit', joinRoom);
  $('guess-form').addEventListener('submit', makeGuess);
  $('leave-room').addEventListener('click', leaveRoom);
  if (!configured()) { showError('Setup required: enter your Supabase URL and publishable anon key in app.js.'); return; }
  state.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
init();
