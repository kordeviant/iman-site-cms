(function(){
  // Fetch the index of image URLs and render a 3x3 grid with 9 random images.
  const indexUrl = '/downloads-index.json';
  const gridId = 'random-downloads-grid';
  const cols = 3;
  const rows = 3;

  function pickRandom(arr, n) {
    const out = [];
    const copy = arr.slice();
    for (let i=0;i<n && copy.length;i++) {
      const idx = Math.floor(Math.random()*copy.length);
      out.push(copy.splice(idx,1)[0]);
    }
    return out;
  }

  function makeImg(url){
    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    return img;
  }

  function render(urls){
    const container = document.getElementById(gridId);
    if(!container) return;
    container.innerHTML = '';
    const chosen = pickRandom(urls, cols*rows);
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridAutoRows = '150px';
    grid.style.gap = '6px';

    chosen.forEach(u => {
      const cell = document.createElement('div');
      cell.style.width = '100%';
      cell.style.height = '100%';
      cell.appendChild(makeImg(u));
      grid.appendChild(cell);
    });

    container.appendChild(grid);
  }

  fetch(indexUrl).then(r=>r.json()).then(urls=>{
    if(!Array.isArray(urls) || urls.length===0) return;
    render(urls);
    // re-render every 10s to get new random selection on refresh interval
    window.setInterval(()=>render(urls), 10000);
  }).catch(()=>{});
})();
