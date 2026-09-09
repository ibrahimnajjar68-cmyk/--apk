(function(){
  var DOMAINS = ["lovable.dev","lovable.app","base44.app","base44.com","bolt.new","v0.dev","v0.app",
    "bubble.io","webflow.com","wix.com","wixsite.com","framer.com","framer.website","carrd.co",
    "glideapps.com","softr.io","durable.co","replit.com","vercel.app/?utm","netlify.app/?utm",
    "wordpress.com","weebly.com","jimdo.com","tilda.cc","canva.site","hostinger","builder.ai",
    "flutterflow.io","adalo.com","glide.page","typedream.com","umso.com","dorik.com","strikingly.com"];
  var TEXTS = ["made with","built with","powered by","created with","edit with","made in",
    "صنع بواسطة","تم الإنشاء بواسطة","مدعوم من","بواسطة"];
  var SEL = ["#lovable-badge","[id*='lovable-badge']","[class*='lovable-badge']","#base44-badge",
    "[id*='base44']","[class*='base44-badge']","#bolt-badge","[class*='bolt-badge']",
    ".w-webflow-badge","#WIX_ADS","#wixAdsTop","#bubble-badge","#carrd-badge",".carrd-badge",
    "[class*='powered-by']","[id*='powered-by']","[class*='built-with']","[data-testid*='badge']"];

  function hostMatch(href){
    if(!href) return false;
    for(var i=0;i<DOMAINS.length;i++){ if(href.toLowerCase().indexOf(DOMAINS[i])>-1) return true; }
    return false;
  }
  function textMatch(el){
    var t=(el.textContent||"").trim().toLowerCase();
    if(!t || t.length>60) return false;
    for(var i=0;i<TEXTS.length;i++){ if(t.indexOf(TEXTS[i])>-1) return true; }
    return false;
  }
  function nuke(el){
    if(!el || el===document.body || el===document.documentElement) return;
    try{
      el.style.setProperty("display","none","important");
      el.style.setProperty("visibility","hidden","important");
      el.style.setProperty("opacity","0","important");
      el.style.setProperty("pointer-events","none","important");
      if(el.parentNode) el.parentNode.removeChild(el);
    }catch(e){}
  }
  function isFloatingBadge(el){
    var cs;
    try{ cs=getComputedStyle(el); }catch(e){ return false; }
    if(cs.position!=="fixed" && cs.position!=="sticky") return false;
    var r=el.getBoundingClientRect();
    if(r.width<=0 || r.height<=0) return false;
    if(r.width>340 || r.height>120) return false;
    var vw=window.innerWidth, vh=window.innerHeight;
    var nearEdge = (r.bottom > vh-140) || (r.top < 140);
    return nearEdge;
  }
  function sweep(){
    var i,j,n;
    for(i=0;i<SEL.length;i++){
      n=document.querySelectorAll(SEL[i]);
      for(j=0;j<n.length;j++) nuke(n[j]);
    }
    // Any link pointing at a builder domain that sits in a floating badge.
    var links=document.querySelectorAll("a[href],iframe[src]");
    for(i=0;i<links.length;i++){
      var el=links[i];
      var href=el.getAttribute("href")||el.getAttribute("src")||"";
      if(!hostMatch(href)) continue;
      var target=el;
      for(var up=0; up<3 && target.parentElement; up++){
        if(isFloatingBadge(target)) break;
        target=target.parentElement;
      }
      if(isFloatingBadge(target) || isFloatingBadge(el)) nuke(isFloatingBadge(target)?target:el);
      else if(textMatch(el)) nuke(el);
    }
    // Heuristic: small floating boxes whose text says "made/built/powered with".
    var all=document.body ? document.body.querySelectorAll("div,span,a,section,aside,footer") : [];
    for(i=0;i<all.length;i++){
      var e=all[i];
      if(e.childElementCount>4) continue;
      if(!textMatch(e)) continue;
      if(isFloatingBadge(e)) nuke(e);
    }
  }
  var st=document.getElementById("__wm_rm");
  if(!st){
    st=document.createElement("style"); st.id="__wm_rm";
    st.textContent=SEL.join(",")+"{display:none !important;visibility:hidden !important;opacity:0 !important;pointer-events:none !important}";
    (document.head||document.documentElement).appendChild(st);
  }
  sweep();
  try{
    var mo=new MutationObserver(function(){ sweep(); });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){}
  setInterval(sweep, 1500);
})();