// ===== Pemilihan elemen (DOM selector) =====
const inputCari = document.querySelector('#cari');
const selectUrut = document.querySelector('#urutkan');
const wadahKategori = document.querySelector('#kategori');
const daftarProduk = document.querySelector('#daftarProduk');
const statusText = document.querySelector('#status');
const dialogDetail = document.querySelector('#dialogDetail');
const isiDetail = document.querySelector('#isiDetail');
const dialogKeranjang = document.querySelector('#dialogKeranjang');
const isiKeranjang = document.querySelector('#isiKeranjang');
const jumlahKeranjang = document.querySelector('#jumlahKeranjang');

// ===== State =====
let semuaProduk = [];
let kategoriAktif = 'semua';
const keranjang = new Map(); // id -> { produk, qty }

// ===== Helper =====
const rupiahUSD = (n) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const hargaAkhir = (p) => p.price * (1 - p.discountPercentage / 100);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent aman dari XSS
  return node;
}

function bintang(rating) {
  const penuh = Math.round(rating);
  return '★'.repeat(penuh) + '☆'.repeat(5 - penuh);
}

// ===== Fetch API =====
async function muatProduk() {
  statusText.textContent = 'Memuat data…';
  try {
    const response = await fetch('data/products.json');
    if (!response.ok) throw new Error('Data gagal dibaca');
    const data = await response.json();
    semuaProduk = data.products;
    buatFilterKategori();
    tampilkanProduk();
  } catch (error) {
    statusText.textContent = 'Gagal mengambil data. Jalankan lewat Live Server (bukan buka file langsung).';
    statusText.classList.add('error');
    console.error(error);
  }
}

// ===== Filter, cari, urut =====
function produkTerfilter() {
  const kata = inputCari.value.trim().toLowerCase();
  let hasil = semuaProduk.filter((p) => {
    const cocokKategori = kategoriAktif === 'semua' || p.category === kategoriAktif;
    const teks = [p.title, p.brand || '', p.category, ...(p.tags || [])].join(' ').toLowerCase();
    return cocokKategori && teks.includes(kata);
  });

  switch (selectUrut.value) {
    case 'harga-asc': hasil.sort((a, b) => hargaAkhir(a) - hargaAkhir(b)); break;
    case 'harga-desc': hasil.sort((a, b) => hargaAkhir(b) - hargaAkhir(a)); break;
    case 'rating-desc': hasil.sort((a, b) => b.rating - a.rating); break;
    case 'nama-asc': hasil.sort((a, b) => a.title.localeCompare(b.title)); break;
  }
  return hasil;
}

function buatFilterKategori() {
  const daftar = ['semua', ...new Set(semuaProduk.map((p) => p.category))];
  wadahKategori.replaceChildren();
  daftar.forEach((kat) => {
    const chip = el('button', 'chip' + (kat === kategoriAktif ? ' active' : ''), kat);
    chip.type = 'button';
    chip.addEventListener('click', () => {
      kategoriAktif = kat;
      wadahKategori.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === chip));
      tampilkanProduk();
    });
    wadahKategori.append(chip);
  });
}

// ===== Render kartu produk =====
function tampilkanProduk() {
  const hasil = produkTerfilter();
  daftarProduk.replaceChildren();
  statusText.classList.remove('error');
  statusText.textContent = hasil.length
    ? `Menampilkan ${hasil.length} produk`
    : 'Tidak ada produk yang cocok. Coba kata kunci lain.';

  hasil.forEach((p) => daftarProduk.append(buatKartu(p)));
}

function buatKartu(p) {
  const kartu = el('article', 'card');

  const gambarWrap = el('div', 'card-img');
  const img = el('img');
  img.src = p.thumbnail;
  img.alt = p.title;
  img.loading = 'lazy';
  gambarWrap.append(img);
  if (p.discountPercentage >= 5) {
    gambarWrap.append(el('span', 'tag-discount', `-${Math.round(p.discountPercentage)}%`));
  }
  gambarWrap.addEventListener('click', () => bukaDetail(p));

  const body = el('div', 'card-body');
  body.append(el('span', 'card-cat', p.category));
  body.append(el('h3', 'card-title', p.title));

  const rating = el('div', 'rating', bintang(p.rating) + ' ');
  rating.append(el('small', '', p.rating.toFixed(1)));
  body.append(rating);

  const stok = el('span', 'stock ' + (p.stock < 10 ? 'low' : 'ok'),
    p.stock < 10 ? `Stok tinggal ${p.stock}` : p.availabilityStatus);
  body.append(stok);

  const harga = el('div', 'price-row');
  harga.append(el('span', 'price', rupiahUSD(hargaAkhir(p))));
  harga.append(el('span', 'price-old', rupiahUSD(p.price)));
  body.append(harga);

  const aksi = el('div', 'card-actions');
  const btnDetail = el('button', 'btn btn-ghost', 'Detail');
  btnDetail.type = 'button';
  btnDetail.addEventListener('click', () => bukaDetail(p));
  const btnTambah = el('button', 'btn btn-primary', '+ Keranjang');
  btnTambah.type = 'button';
  btnTambah.addEventListener('click', () => tambahKeKeranjang(p));
  aksi.append(btnDetail, btnTambah);

  kartu.append(gambarWrap, body, aksi);
  return kartu;
}

// ===== Dialog detail =====
function bukaDetail(p) {
  isiDetail.replaceChildren();
  const wrap = el('div', 'detail');

  const kiri = el('div');
  const gambarUtama = el('img', 'detail-main-img');
  gambarUtama.src = p.images?.[0] || p.thumbnail;
  gambarUtama.alt = p.title;
  kiri.append(gambarUtama);
  if (p.images && p.images.length > 1) {
    const thumbs = el('div', 'thumbs');
    p.images.forEach((url, i) => {
      const t = el('img', i === 0 ? 'active' : '');
      t.src = url;
      t.alt = `${p.title} foto ${i + 1}`;
      t.addEventListener('click', () => {
        gambarUtama.src = url;
        thumbs.querySelectorAll('img').forEach((x) => x.classList.toggle('active', x === t));
      });
      thumbs.append(t);
    });
    kiri.append(thumbs);
  }

  const kanan = el('div');
  kanan.append(el('span', 'card-cat', p.category + (p.brand ? ' · ' + p.brand : '')));
  kanan.append(el('h2', '', p.title));
  const rating = el('div', 'rating', bintang(p.rating) + ' ');
  rating.append(el('small', '', `${p.rating.toFixed(1)} dari 5`));
  kanan.append(rating);

  const harga = el('div', 'price-row');
  harga.append(el('span', 'price', rupiahUSD(hargaAkhir(p))));
  harga.append(el('span', 'price-old', rupiahUSD(p.price)));
  harga.append(el('span', 'tag-discount', `-${p.discountPercentage}%`));
  harga.querySelector('.tag-discount').style.position = 'static';
  kanan.append(harga);

  kanan.append(el('p', '', p.description));

  const info = el('ul', 'info-list');
  [
    ['Ketersediaan', `${p.availabilityStatus} (${p.stock} unit)`],
    ['Pengiriman', p.shippingInformation],
    ['Garansi', p.warrantyInformation],
    ['Pengembalian', p.returnPolicy],
    ['Minimal order', `${p.minimumOrderQuantity} unit`],
  ].forEach(([k, v]) => {
    const li = el('li');
    li.append(el('strong', '', k + ': '), document.createTextNode(v));
    info.append(li);
  });
  kanan.append(info);

  const btn = el('button', 'btn btn-primary', 'Tambah ke keranjang');
  btn.type = 'button';
  btn.addEventListener('click', () => tambahKeKeranjang(p));
  kanan.append(btn);

  if (p.reviews?.length) {
    const ulasan = el('div', 'reviews');
    ulasan.append(el('h3', '', 'Ulasan pembeli'));
    p.reviews.forEach((r) => {
      const item = el('div', 'review');
      item.append(el('b', '', `${r.reviewerName} · ${bintang(r.rating)}`), document.createTextNode(r.comment));
      ulasan.append(item);
    });
    kanan.append(ulasan);
  }

  wrap.append(kiri, kanan);
  isiDetail.append(wrap);
  dialogDetail.showModal();
}

// ===== Keranjang =====
function tambahKeKeranjang(p) {
  const item = keranjang.get(p.id);
  if (item) item.qty += 1;
  else keranjang.set(p.id, { produk: p, qty: 1 });
  perbaruiKeranjang();
  statusText.textContent = `"${p.title}" ditambahkan ke keranjang.`;
}

function ubahQty(id, delta) {
  const item = keranjang.get(id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) keranjang.delete(id);
  perbaruiKeranjang();
  tampilkanKeranjang();
}

function perbaruiKeranjang() {
  let total = 0;
  keranjang.forEach((i) => (total += i.qty));
  jumlahKeranjang.textContent = total;
}

function tampilkanKeranjang() {
  isiKeranjang.replaceChildren();
  if (keranjang.size === 0) {
    isiKeranjang.append(el('p', 'empty', 'Keranjang masih kosong.'));
    return;
  }
  let total = 0;
  keranjang.forEach(({ produk, qty }) => {
    total += hargaAkhir(produk) * qty;
    const baris = el('div', 'cart-item');
    const info = el('div');
    info.append(el('strong', '', produk.title), el('small', '', rupiahUSD(hargaAkhir(produk)) + ' / unit'));

    const qtyBox = el('div', 'qty');
    const min = el('button', '', '−');
    min.type = 'button';
    min.addEventListener('click', () => ubahQty(produk.id, -1));
    const plus = el('button', '', '+');
    plus.type = 'button';
    plus.addEventListener('click', () => ubahQty(produk.id, 1));
    qtyBox.append(min, el('span', '', String(qty)), plus);

    baris.append(info, qtyBox);
    isiKeranjang.append(baris);
  });
  const totalRow = el('div', 'cart-total');
  totalRow.append(el('span', '', 'Total'), el('span', '', rupiahUSD(total)));
  isiKeranjang.append(totalRow);
}

// ===== Event listener =====
inputCari.addEventListener('input', tampilkanProduk);
selectUrut.addEventListener('change', tampilkanProduk);
document.querySelector('#btnKeranjang').addEventListener('click', () => {
  tampilkanKeranjang();
  dialogKeranjang.showModal();
});
document.querySelector('#tutupDetail').addEventListener('click', () => dialogDetail.close());
document.querySelector('#tutupKeranjang').addEventListener('click', () => dialogKeranjang.close());
[dialogDetail, dialogKeranjang].forEach((d) =>
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); })
);

muatProduk();
