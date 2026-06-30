import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 

const KontribusiKlasis = () => {
  const [tahunPilih, setTahunPilih] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  
  // ==========================================
  // STATE PENDAPATAN (TABEL ATAS)
  // ==========================================
  const [rawPendapatan, setRawPendapatan] = useState([]);
  const [katPendapatanTersedia, setKatPendapatanTersedia] = useState([]);
  const [katPendapatanPilih, setKatPendapatanPilih] = useState('');
  const [matriksPendapatan, setMatriksPendapatan] = useState([]);

  // ==========================================
  // STATE PENGELUARAN (TABEL BAWAH)
  // ==========================================
  const [rawPengeluaran, setRawPengeluaran] = useState([]);
  const [katPengeluaranTersedia, setKatPengeluaranTersedia] = useState([]);
  const [katPengeluaranPilih, setKatPengeluaranPilih] = useState('');
  const [matriksPengeluaran, setMatriksPengeluaran] = useState([]);

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const OPSI_SEMUA = "SEMUA KATEGORI (Gabungan)";

  // 1. FUNGSI TARIK DATA (PENDAPATAN & PENGELUARAN SEKALIGUS)
  const handleTarikDataTahun = async (e) => {
    e.preventDefault();
    if (!tahunPilih) return alert('Mohon isi tahun.');

    setLoading(true);
    // Reset Data
    setRawPendapatan([]); setKatPendapatanTersedia([]); setKatPendapatanPilih(''); setMatriksPendapatan([]);
    setRawPengeluaran([]); setKatPengeluaranTersedia([]); setKatPengeluaranPilih(''); setMatriksPengeluaran([]);

    try {
      const transaksiRef = collection(db, 'transaksi');
      const startDate = `${tahunPilih}-01-01`;
      const endDate = `${tahunPilih}-12-31`;

      // --- TARIK PENDAPATAN ---
      const qPendapatan = query(transaksiRef, where('jenis', '==', 'pendapatan'), where('tanggal', '>=', startDate), where('tanggal', '<=', endDate));
      const snapPendapatan = await getDocs(qPendapatan);
      const fetchedPendapatan = [];
      const uniqKatPendapatan = new Set();

      snapPendapatan.forEach((doc) => {
        const data = doc.data();
        fetchedPendapatan.push(data);
        if (data.kategori) uniqKatPendapatan.add(data.kategori.trim());
      });

      const sortedKatPendapatan = [OPSI_SEMUA, ...Array.from(uniqKatPendapatan).sort()];
      setRawPendapatan(fetchedPendapatan);
      setKatPendapatanTersedia(sortedKatPendapatan);
      setKatPendapatanPilih(OPSI_SEMUA);

      // --- TARIK PENGELUARAN (Fokus Kategori C & D) ---
      const qPengeluaran = query(transaksiRef, where('jenis', '==', 'pengeluaran'), where('tanggal', '>=', startDate), where('tanggal', '<=', endDate));
      const snapPengeluaran = await getDocs(qPengeluaran);
      const fetchedPengeluaran = [];
      const uniqKatPengeluaran = new Set();

      snapPengeluaran.forEach((doc) => {
        const data = doc.data();
        const kategori = (data.kategori || '').trim().toUpperCase();
        if (kategori.startsWith('C') || kategori.startsWith('D')) {
          fetchedPengeluaran.push(data);
          uniqKatPengeluaran.add(data.kategori.trim());
        }
      });

      const sortedKatPengeluaran = [OPSI_SEMUA, ...Array.from(uniqKatPengeluaran).sort()];
      setRawPengeluaran(fetchedPengeluaran);
      setKatPengeluaranTersedia(sortedKatPengeluaran);
      setKatPengeluaranPilih(OPSI_SEMUA);

      if (fetchedPendapatan.length === 0 && fetchedPengeluaran.length === 0) {
        alert(`Tidak ada data sama sekali ditemukan untuk tahun ${tahunPilih}`);
      }

    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menarik data. Pastikan koneksi stabil.');
    } finally {
      setLoading(false);
    }
  };

  // 2. BENTUK MATRIKS PENDAPATAN (Jika Dropdown Pendapatan Berubah)
  useEffect(() => {
    if (rawPendapatan.length > 0 && katPendapatanPilih) {
      let rekap = Array.from({ length: 12 }, (_, i) => ({ idBulan: i + 1, nama: namaBulan[i], koa: 0, haususu: 0, total: 0 }));
      rawPendapatan.forEach((data) => {
        const kategoriData = (data.kategori || '').trim();
        if (katPendapatanPilih === OPSI_SEMUA || kategoriData === katPendapatanPilih) {
          const tanggal = data.tanggal || ''; 
          const nominal = Number(data.nominal || 0);
          const jemaat = (data.jemaat || '').toLowerCase();
          const bulanIndex = parseInt(tanggal.split('-')[1]) - 1;
          
          if (bulanIndex >= 0 && bulanIndex < 12) {
            if (jemaat.includes('koa')) rekap[bulanIndex].koa += nominal;
            else if (jemaat.includes('haususu')) rekap[bulanIndex].haususu += nominal;
            else rekap[bulanIndex].koa += nominal;
            rekap[bulanIndex].total += nominal;
          }
        }
      });
      setMatriksPendapatan(rekap);
    }
  }, [katPendapatanPilih, rawPendapatan]);

  // 3. BENTUK MATRIKS PENGELUARAN (Jika Dropdown Pengeluaran Berubah)
  useEffect(() => {
    if (rawPengeluaran.length > 0 && katPengeluaranPilih) {
      let rekap = Array.from({ length: 12 }, (_, i) => ({ idBulan: i + 1, nama: namaBulan[i], totalBulan: 0 }));
      rawPengeluaran.forEach((data) => {
        const kategoriData = (data.kategori || '').trim();
        if (katPengeluaranPilih === OPSI_SEMUA || kategoriData === katPengeluaranPilih) {
          const tanggal = data.tanggal || ''; 
          const nominal = Number(data.nominal || 0);
          const bulanIndex = parseInt(tanggal.split('-')[1]) - 1;
          
          if (bulanIndex >= 0 && bulanIndex < 12) {
            rekap[bulanIndex].totalBulan += nominal;
          }
        }
      });
      setMatriksPengeluaran(rekap);
    }
  }, [katPengeluaranPilih, rawPengeluaran]);

  // Kalkulasi Total
  const totalPendapatanTahun = useMemo(() => matriksPendapatan.reduce((sum, item) => sum + item.total, 0), [matriksPendapatan]);
  const totalPengeluaranTahun = useMemo(() => matriksPengeluaran.reduce((sum, item) => sum + item.totalBulan, 0), [matriksPengeluaran]);

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);

  // 4. FUNGSI SIMPAN ARSIP KOMPARASI
  const handleSimpanArsip = async () => {
    if (matriksPendapatan.length === 0 && matriksPengeluaran.length === 0) return;
    const idArsip = `${tahunPilih}_KomparasiKlasis`; 

    if (!window.confirm(`Simpan matriks komparasi tahun ${tahunPilih} ke database?`)) return;
    try {
      await setDoc(doc(db, 'arsip_kontribusi_tahunan', idArsip), {
        tahun: tahunPilih,
        jenis: 'komparasi_klasis',
        filter_pendapatan: katPendapatanPilih,
        matriks_pendapatan: matriksPendapatan,
        grand_total_pendapatan: totalPendapatanTahun,
        filter_pengeluaran: katPengeluaranPilih,
        matriks_pengeluaran: matriksPengeluaran,
        grand_total_pengeluaran: totalPengeluaranTahun,
        waktu_simpan: new Date().toISOString()
      });
      alert('Arsip Komparasi Klasis berhasil disimpan!');
    } catch (error) {
      alert('Gagal menyimpan arsip.');
    }
  };

  // 5. FUNGSI EKSPOR EXCEL (Mencetak ke-2 tabel)
  const unduhExcel = () => {
    let tableHTML = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head><meta charset="utf-8"></head>
        <body>
          <h2>KOMPARASI SETORAN KLASIS TAHUN ${tahunPilih}</h2>
          
          <h3>A. MATRIKS PENDAPATAN (TARGET) - Filter: ${katPendapatanPilih}</h3>
          <table border="1">
            <thead style="background-color: #e0e7ff;">
              <tr><th>No</th><th>Bulan</th><th>Imanuel Koa</th><th>Syalom Haususu</th><th>Total Pendapatan</th></tr>
            </thead>
            <tbody>
              ${matriksPendapatan.map((item, index) => `
                <tr><td align="center">${index + 1}</td><td>${item.nama}</td><td align="right">${item.koa}</td><td align="right">${item.haususu}</td><td align="right"><b>${item.total}</b></td></tr>
              `).join('')}
              <tr style="background-color: #c7d2fe; font-weight: bold;"><td colspan="4" align="right">GRAND TOTAL PENDAPATAN</td><td align="right">${totalPendapatanTahun}</td></tr>
            </tbody>
          </table>
          
          <br><br>

          <h3>B. MATRIKS PENGELUARAN (REALISASI) - Filter: ${katPengeluaranPilih}</h3>
          <table border="1">
            <thead style="background-color: #fee2e2;">
              <tr><th>No</th><th>Bulan Realisasi</th><th>Total Disetorkan (Rp)</th></tr>
            </thead>
            <tbody>
              ${matriksPengeluaran.map((item, index) => `
                <tr><td align="center">${index + 1}</td><td>${item.nama}</td><td align="right"><b>${item.totalBulan}</b></td></tr>
              `).join('')}
              <tr style="background-color: #fecaca; font-weight: bold;"><td colspan="2" align="right">GRAND TOTAL PENGELUARAN</td><td align="right">${totalPengeluaranTahun}</td></tr>
            </tbody>
          </table>
      </body></html>
    `;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Komparasi_Klasis_${tahunPilih}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header & Filter Tahun */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Komparasi Realisasi Klasis</h1>
              <p className="text-slate-500 mt-1">Bandingkan Matriks Pendapatan (Target) vs Pengeluaran (Realisasi) dalam 1 Tahun.</p>
            </div>
            {(matriksPendapatan.length > 0 || matriksPengeluaran.length > 0) && (
              <div className="flex gap-2">
                <button onClick={unduhExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition">XLS</button>
                <button onClick={handleSimpanArsip} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition">💾 Simpan Arsip</button>
              </div>
            )}
          </div>

          <form onSubmit={handleTarikDataTahun} className="flex gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium mb-1 text-slate-700">Tahun Buku</label>
              <input type="number" min="2020" max="2100" required value={tahunPilih} onChange={(e) => setTahunPilih(e.target.value)} className="w-full border rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={loading} className="w-full md:w-1/4 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-md transition">
              {loading ? 'Memproses...' : 'Tarik Data Dasar'}
            </button>
          </form>
        </div>

        {/* AREA KOMPARASI (MUNCUL JIKA ADA DATA) */}
        {(katPendapatanTersedia.length > 0 || katPengeluaranTersedia.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* KOLOM KIRI: PENDAPATAN */}
            <div className="space-y-4">
              <div className="bg-indigo-50 p-4 rounded-lg shadow-sm border border-indigo-200">
                <label className="block text-sm font-bold mb-1 text-indigo-900">Filter Kategori Pendapatan (Target)</label>
                <select value={katPendapatanPilih} onChange={(e) => setKatPendapatanPilih(e.target.value)} className="w-full border border-indigo-300 rounded-md p-2 outline-none bg-white font-medium text-slate-800">
                  {katPendapatanTersedia.map((kat, index) => <option key={index} value={kat}>{kat}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
                <div className="bg-indigo-600 p-3"><h2 className="text-white font-bold text-center">MATRIKS PENDAPATAN</h2></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-800">
                      <tr>
                        <th className="p-2 border-b border-slate-300 font-bold text-center">Bulan</th>
                        <th className="p-2 border-b border-slate-300 font-bold text-center">Koa</th>
                        <th className="p-2 border-b border-slate-300 font-bold text-center">Haususu</th>
                        <th className="p-2 border-b border-slate-300 font-bold text-center bg-indigo-50">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matriksPendapatan.map((item, index) => (
                        <tr key={index} className={`hover:bg-slate-50 ${item.total > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                          <td className="p-2 border-b border-slate-200 font-medium">{item.nama}</td>
                          <td className="p-2 border-b border-slate-200 text-right">{item.koa > 0 ? formatRupiah(item.koa) : '-'}</td>
                          <td className="p-2 border-b border-slate-200 text-right">{item.haususu > 0 ? formatRupiah(item.haususu) : '-'}</td>
                          <td className={`p-2 border-b border-slate-200 text-right font-bold bg-indigo-50/50 ${item.total > 0 ? 'text-indigo-700' : ''}`}>
                            {item.total > 0 ? formatRupiah(item.total) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-indigo-100 font-bold text-indigo-900">
                        <td className="p-3 text-right" colSpan="3">TOTAL TARGET PENDAPATAN</td>
                        <td className="p-3 text-right">{formatRupiah(totalPendapatanTahun)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* KOLOM KANAN: PENGELUARAN */}
            <div className="space-y-4">
              <div className="bg-red-50 p-4 rounded-lg shadow-sm border border-red-200">
                <label className="block text-sm font-bold mb-1 text-red-900">Filter Kategori Pengeluaran (Realisasi)</label>
                <select value={katPengeluaranPilih} onChange={(e) => setKatPengeluaranPilih(e.target.value)} className="w-full border border-red-300 rounded-md p-2 outline-none bg-white font-medium text-slate-800">
                  {katPengeluaranTersedia.map((kat, index) => <option key={index} value={kat}>{kat}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
                <div className="bg-red-600 p-3"><h2 className="text-white font-bold text-center">MATRIKS PENGELUARAN</h2></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left whitespace-nowrap text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-800">
                      <tr>
                        <th className="p-2 border-b border-slate-300 font-bold text-center">Bulan Realisasi</th>
                        <th className="p-2 border-b border-slate-300 font-bold text-center bg-red-50">Total Disetorkan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matriksPengeluaran.map((item, index) => (
                        <tr key={index} className={`hover:bg-slate-50 ${item.totalBulan > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
                          <td className="p-2 border-b border-slate-200 font-medium">{item.nama}</td>
                          <td className={`p-2 border-b border-slate-200 text-right font-bold bg-red-50/50 ${item.totalBulan > 0 ? 'text-red-600' : ''}`}>
                            {item.totalBulan > 0 ? formatRupiah(item.totalBulan) : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-red-100 font-bold text-red-900">
                        <td className="p-3 text-right">TOTAL REALISASI SETORAN</td>
                        <td className="p-3 text-right">{formatRupiah(totalPengeluaranTahun)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default KontribusiKlasis;