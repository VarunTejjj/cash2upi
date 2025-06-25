document.getElementById('cashbot-toggle').onclick = () => {
  const chat = document.getElementById('cashbot-chat');
  chat.style.display = chat.style.display === 'none' ? 'block' : 'none';
};

document.getElementById('cashbot-input').addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const input = e.target.value.trim();
    if (!input) return;

    const messages = document.getElementById('cashbot-messages');
    messages.innerHTML += `<div><b>You:</b> ${input}</div>`;

    e.target.value = '';
    messages.innerHTML += `<div><i>CashBot is typing...</i></div>`;
    messages.scrollTop = messages.scrollHeight;

    const response = await fetch('/cashbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: input })
    });

    const data = await response.json();
    messages.innerHTML = messages.innerHTML.replace(`<div><i>CashBot is typing...</i></div>`, '');
    messages.innerHTML += `<div><b>CashBot:</b> ${data.reply}</div>`;
    messages.scrollTop = messages.scrollHeight;
  }
});
