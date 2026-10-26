(function(){
  const nav=document.querySelector('.retail-bottom-nav');
  const page=document.getElementById('retailCustomerPage');
  if(!nav||!page)return;
  if(!nav.querySelector('[data-retail-tab="invite"]')){
    const profile=nav.querySelector('[data-retail-tab="profile"]');
    const b=document.createElement('button');b.type='button';b.dataset.retailTab='invite';b.setAttribute('aria-label','Invite friends');
    b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 8v6M16 11h6"/></svg><span>Invite</span>';
    nav.insertBefore(b,profile||null);
    nav.style.gridTemplateColumns='repeat(6,minmax(0,1fr))';
  }
  const db=window.supabase.createClient("https://oebapdfkaumpmwdblqbv.supabase.co","sb_publishable_wmNek6qB6MCiPIJzueJhVQ_7-6d42yl");
  function openPage(){page.classList.add('open');document.body.classList.add('rc-page-open');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.retailTab==='invite'))}
  function closePage(){page.classList.remove('open');document.body.classList.remove('rc-page-open');nav.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x.dataset.retailTab==='home'))}
  function draw(code,email){
    const link=location.origin+location.pathname+'?ref='+encodeURIComponent(code);
    page.innerHTML='<div class="rc-head"><button class="rc-back" id="retailInviteBack" type="button">← Back</button><h1>Invite Friends</h1></div>'+
      '<section class="rc-card"><div style="font-size:42px">🎁</div><h2 style="margin:8px 0">Share RETAIL with friends</h2><p class="rc-muted">Invite friends to join RETAIL. They can open your personal invite link and create an account.</p>'+
      '<label>Your invite code</label><div class="rc-row" style="margin-top:6px"><strong style="font-size:23px;letter-spacing:2px;color:#0757d9">'+code+'</strong><button class="rc-btn secondary" id="retailCopyCode" type="button">Copy code</button></div>'+
      '<label>Invite link</label><input id="retailInviteLink" readonly value="'+link.replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'">'+
      '<button class="rc-btn" id="retailShareInvite" type="button" style="width:100%;margin-top:12px">Share invite link</button>'+
      '<p class="rc-muted" id="retailInviteMsg" role="status" style="margin-top:10px">Invite sharing is available. Rewards or referral coins are not currently confirmed as enabled.</p></section>';
    document.getElementById('retailInviteBack').onclick=closePage;
    document.getElementById('retailCopyCode').onclick=async()=>{try{await navigator.clipboard.writeText(code);document.getElementById('retailInviteMsg').textContent='Invite code copied. Share it with your friends.'}catch(e){const i=document.getElementById('retailInviteLink');i.focus();i.select();document.getElementById('retailInviteMsg').textContent='Select and copy your invite code or link.'}};
    document.getElementById('retailShareInvite').onclick=async()=>{const text='Join me on RETAIL marketplace! Use my invite code '+code+' or open this link: '+link;try{if(navigator.share)await navigator.share({title:'Join RETAIL',text,url:link});else{await navigator.clipboard.writeText(text);document.getElementById('retailInviteMsg').textContent='Invite message copied. Paste it into WhatsApp or another app.'}}catch(e){if(e.name!=='AbortError')document.getElementById('retailInviteMsg').textContent='Copy this invite link and send it to your friends.'}};
  }
  async function showInvite(){
    openPage();page.innerHTML='<div class="rc-head"><button class="rc-back" id="retailInviteBack" type="button">← Back</button><h1>Invite Friends</h1></div><section class="rc-card">Loading your invite link…</section>';
    document.getElementById('retailInviteBack').onclick=closePage;
    try{
      const {data,error}=await db.auth.getUser();const u=data&&data.user;
      if(error||!u){page.innerHTML='<div class="rc-head"><button class="rc-back" id="retailInviteBack" type="button">← Back</button><h1>Invite Friends</h1></div><section class="rc-card"><h2>Login to get your invite link</h2><p class="rc-muted">Create or log in to your RETAIL account first. Your invite code will be linked to your account.</p><button class="rc-btn" id="retailInviteLogin" type="button">Login / Create account</button></section>';document.getElementById('retailInviteBack').onclick=closePage;document.getElementById('retailInviteLogin').onclick=()=>{closePage();document.getElementById('loginBtn')?.click()};return}
      const code=String(u.id||'').replace(/-/g,'').slice(0,8).toUpperCase();
      try{localStorage.setItem('retail_my_referral_code',code)}catch(e){}
      draw(code,u.email||'');
    }catch(e){page.innerHTML='<div class="rc-head"><button class="rc-back" id="retailInviteBack" type="button">← Back</button><h1>Invite Friends</h1></div><section class="rc-card"><p>Could not load your invite code. Please refresh and try again.</p></section>';document.getElementById('retailInviteBack').onclick=closePage}
  }
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-retail-tab]');if(!b)return;if(b.dataset.retailTab==='invite'){e.preventDefault();showInvite()}});
})();