// main.js - Global JS for Cryptohama
console.log("Cryptohama loaded. Start earning free crypto!");

document.addEventListener('DOMContentLoaded', function() {
  // Compact hover effects
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(btn => {
    btn.addEventListener('mouseenter', () => btn.style.transform = 'translateY(-1px)');
    btn.addEventListener('mouseleave', () => btn.style.transform = 'translateY(0)');
  });

  // Track join clicks
  document.querySelectorAll('.btn-join').forEach(btn => {
    btn.addEventListener('click', function() {
      const faucetName = this.closest('.faucet-card').querySelector('.faucet-title').textContent;
      console.log(`User clicked Join for: ${faucetName}`);
    });
  });
});
