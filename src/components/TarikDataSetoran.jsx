import React, { useState, useMemo } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 

const TarikDataSetoran = () => {
  const [bulanPilih, setBulanPilih] = useState('');
  const [loading, setLoading] = useState(false);
  
  // State untuk Data Penerimaan (Matriks)
  const [dataPendapatan, setDataPendapatan] = useState([]);
  
  // State untuk Data Pengeluaran (Realisasi Setoran C & D)
  const [dataPengeluaran, setDataPengeluaran] = useState([]);

  // State Modal Sisipan (Pengeluaran)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [manualData, setManualData] = useState({
    tanggal: '', kategori: '', keterangan: '', nominal: ''
  });

  const handleTarikData = async (e) => {
    e.preventDefault();
    if (!bulanPilih) return alert('Mohon pilih bulan penerimaan terlebih dahulu.');

    setLoading(true);
    setDataPendapatan([]);
    setDataPengeluaran([]);

    try {
      const transaksiRef = collection(db, 'transaksi');
      
      // 1. SETUP TANGGAL PENERIMAAN
      const [year, month] = bulanPilih.split('-');
      const lastDayIncome = new Date(year, parseInt(month), 0).getDate();
      const startDateIncome = `${bulanPilih}-01`;
      const endDateIncome = `${bulanPilih}-${lastDayIncome}`;

      // 2. SETUP TANGGAL PENGELUARAN (BULAN BERIKUTNYA)
      const nextMonthDate = new Date(year, parseInt(month), 1); 
      const nextYearStr = nextMonthDate.getFullYear();
      const nextMonthStr = String(nextMonthDate.getMonth() + 1).padStart(2, '0');
      
      const lastDayExpense = new Date(nextYearStr, nextMonthDate.getMonth() + 1, 0).getDate();
      const startDateExpense = `${nextYearStr}-${nextMonthStr}-01`;
      const endDateExpense = `${nextYearStr}-${nextMonthStr}-${lastDayExpense}`;

      // ==========================================
      // 3. TARIK DATA PENDAPATAN (MATRIKS JEMAAT)
      // ==========================================
      const qPendapatan = query(
        transaksiRef,
        where('jenis', '==', 'pendapatan'),
        where('tanggal', '>=', startDateIncome),
        where('tanggal', '<=', endDateIncome)
      );
      
      const snapPendapatan = await getDocs(qPendapatan);
      const groupedData = {};

      snapPendapatan.forEach((doc) => {
        const data = doc.data();
        const kategori = data.kategori || 'Tanpa Kategori';
        const tanggal = data.tanggal || '';
        const jemaat = (data.jemaat || '').toLowerCase();
        const nominal = Number(data.nominal || 0);

        // Grouping berdasarkan Tanggal DAN Kategori agar kolom tanggal bisa ditampilkan
        const key = `${tanggal}_${kategori}`;

        if (!groupedData[key]) {
          groupedData[key] = { id: doc.id, keyObj: key, tanggal: tanggal, uraian: kategori, koa: 0, haususu: 0 };
        }

        if (jemaat.includes('koa')) groupedData[key].koa += nominal;
        else if (jemaat.includes('haususu')) groupedData[key].haususu += nominal;
        else groupedData[key].koa += nominal; 
      });

      let fetchedPendapatan = Object.values(groupedData);
      // Sort berdasarkan tanggal, lalu abjad uraian
      fetchedPendapatan.sort((a, b) => {
        if (a.tanggal === b.tanggal) return a.uraian.localeCompare(b.uraian);
        return new Date(a.tanggal) - new Date(b.tanggal);
      });
      setDataPendapatan(fetchedPendapatan);

      // ==========================================
      // 4. TARIK DATA PENGELUARAN (KATEGORI C & D)
      // ==========================================
      const qPengeluaran = query(
        transaksiRef,
        where('jenis', '==', 'pengeluaran'),
        where('tanggal', '>=', startDateExpense),
        where('tanggal', '<=', endDateExpense)
      );

      const snapPengeluaran = await getDocs(qPengeluaran);
      let fetchedPengeluaran = [];

      snapPengeluaran.forEach((doc) => {
        const data = doc.data();
        const kategori = (data.kategori || '').toUpperCase();
        
        if (kategori.startsWith('C') || kategori.startsWith('D')) {
          fetchedPengeluaran.push({ id: doc.id, ...data });
        }
      });

      // Sort berdasarkan ABJAD KATEGORI (Permintaan ke-2)
      fetchedPengeluaran.sort((a, b) => (a.kategori || '').localeCompare(b.kategori || ''));
      setDataPengeluaran(fetchedPengeluaran);

    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menarik data. Pastikan indeks Firestore sudah aktif.');
    } finally {
      setLoading(false);
    }
  };

  // Kalkulasi Total Pendapatan
  const { totalKoa, totalHaususu, grandTotalPendapatan } = useMemo(() => {
    let koa = 0; let haususu = 0;
    dataPendapatan.forEach(item => { koa += item.koa; haususu += item.haususu; });
    return { totalKoa: koa, totalHaususu: haususu, grandTotalPendapatan: koa + haususu };
  }, [dataPendapatan]);

  // Kalkulasi Total Pengeluaran
  const grandTotalPengeluaran = useMemo(() => {
    return dataPengeluaran.reduce((sum, item) => sum + Number(item.nominal || 0), 0);
  }, [dataPengeluaran]);

  // Fungsi Hapus (Batal) untuk masing-masing tabel
  const handleHapusPendapatan = (idYangDihapus) => {
    setDataPendapatan(prev => prev.filter(i => i.id !== idYangDihapus));
  };
  const handleHapusPengeluaran = (idYangDihapus) => {
    setDataPengeluaran(prev => prev.filter(i => i.id !== idYangDihapus));
  };

  // Tambah baris manual (Sisipan ke Pengeluaran)
  const handleTambahManual = (e) => {
    e.preventDefault();
    const newItem = {
      id: `manual-${Date.now()}`,
      tanggal: manualData.tanggal,
      kategori: manualData.kategori,
      keterangan: manualData.keterangan,
      nominal: Number(manualData.nominal || 0),
      isManual: true,
      jenis: 'pengeluaran'
    };
    
    const newData = [...dataPengeluaran, newItem];
    // Pastikan tetap terurut berdasarkan kategori saat ditambah manual
    newData.sort((a, b) => (a.kategori || '').localeCompare(b.kategori || ''));
    
    setDataPengeluaran(newData);
    setIsModalOpen(false);
    setManualData({ tanggal: '', kategori: '', keterangan: '', nominal: '' }); 
  };

  const handleSimpanBAP = async () => {
    if (dataPendapatan.length === 0 && dataPengeluaran.length === 0) return alert('Tidak ada data!');
    
    const [year, month] = bulanPilih.split('-');
    const nextMonthDate = new Date(year, parseInt(month), 1); 
    const bulanSetor = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;

    if (!window.confirm(`Simpan Arsip?\nDasar Penerimaan: ${bulanPilih}\nRealisasi Setor: ${bulanSetor}`)) return;

    setLoading(true);
    try {
      await setDoc(doc(db, 'arsip_setoran', bulanPilih), {
        bulan_penerimaan: bulanPilih,
        bulan_setoran: bulanSetor,
        rincian_pendapatan: dataPendapatan,
        total_pendapatan: grandTotalPendapatan,
        rincian_pengeluaran: dataPengeluaran,
        total_pengeluaran: grandTotalPengeluaran,
        waktu_simpan: new Date().toISOString()
      });
      alert('Data terpadu berhasil disimpan dan siap ditarik ke Cetak Kwitansi!');
    } catch (error) {
      alert('Gagal menyimpan.');
    } finally {
      setLoading(false);
    }
  };

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
  
  const namaBulan = (formatYYYYMM) => {
    if (!formatYYYYMM) return '';
    const [y, m] = formatYYYYMM.split('-');
    return new Date(y, parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header & Filter */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Tarik Data BAP Klasis</h1>
              <p className="text-slate-500 mt-1">Menggabungkan Basis Penerimaan dan Realisasi Pengeluaran secara sinkron.</p>
            </div>
            {(dataPendapatan.length > 0 || dataPengeluaran.length > 0) && (
              <button onClick={handleSimpanBAP} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-6 rounded-md shadow-md transition">
                {loading ? 'Menyimpan...' : '💾 Simpan Arsip Terpadu'}
              </button>
            )}
          </div>

          <form onSubmit={handleTarikData} className="flex gap-4 items-end">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium mb-1 text-slate-700">Bulan Basis Penerimaan</label>
              <input type="month" required value={bulanPilih} onChange={(e) => setBulanPilih(e.target.value)} className="w-full border border-slate-300 rounded-md p-2 focus:ring-blue-500" />
            </div>
            <button type="submit" disabled={loading} className="w-full md:w-1/4 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition">
              {loading ? 'Memproses...' : 'Tarik Data'}
            </button>
          </form>
        </div>

        {/* BAGIAN 1: MATRIKS PENDAPATAN */}
        {dataPendapatan.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
            <div className="bg-indigo-50 border-b border-slate-300 p-4">
              <h2 className="text-lg font-bold text-indigo-900">1. Matriks Basis Penerimaan</h2>
              <p className="text-sm text-indigo-700">Data dari bulan: <span className="font-bold">{namaBulan(bulanPilih)}</span></p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="w-full text-left whitespace-nowrap text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-800">
                  <tr>
                    <th className="p-2 border border-slate-300 font-bold text-center w-12">No</th>
                    <th className="p-2 border border-slate-300 font-bold text-center w-28">Tanggal</th>
                    <th className="p-2 border border-slate-300 font-bold text-center">Uraian / Kategori</th>
                    <th className="p-2 border border-slate-300 font-bold text-center w-32">Imanuel Koa</th>
                    <th className="p-2 border border-slate-300 font-bold text-center w-32">Syalom Haususu</th>
                    <th className="p-2 border border-slate-300 font-bold text-center w-20">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {dataPendapatan.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 text-center">{index + 1}</td>
                      <td className="p-2 border border-slate-300 text-center">{item.tanggal}</td>
                      <td className="p-2 border border-slate-300 font-medium">{item.uraian}</td>
                      <td className="p-2 border border-slate-300 text-right">{item.koa > 0 ? formatRupiah(item.koa) : '-'}</td>
                      <td className="p-2 border border-slate-300 text-right">{item.haususu > 0 ? formatRupiah(item.haususu) : '-'}</td>
                      <td className="p-2 border border-slate-300 text-center">
                        <button onClick={() => handleHapusPendapatan(item.id)} className="bg-red-100 text-red-700 font-bold py-1 px-3 rounded text-xs hover:bg-red-200">Batal</button>
                      </td>
                    </tr>
                  ))}
                  {/* Footer 1: Jumlah per Mata Jemaat */}
                  <tr className="bg-slate-100 font-bold">
                    <td className="p-2 border border-slate-300 text-right" colSpan="3">Jumlah Penerimaan Parsial</td>
                    <td className="p-2 border border-slate-300 text-right text-indigo-700">{formatRupiah(totalKoa)}</td>
                    <td className="p-2 border border-slate-300 text-right text-purple-700">{formatRupiah(totalHaususu)}</td>
                    <td className="p-2 border border-slate-300"></td>
                  </tr>
                  {/* Footer 2: Total Keseluruhan Penerimaan */}
                  <tr className="bg-indigo-100 font-bold text-base">
                    <td className="p-3 border border-slate-300 text-right uppercase tracking-wider" colSpan="3">Total Keseluruhan Penerimaan</td>
                    <td className="p-3 border border-slate-300 text-center text-indigo-900" colSpan="2">{formatRupiah(grandTotalPendapatan)}</td>
                    <td className="p-3 border border-slate-300"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* BAGIAN 2: REALISASI PENGELUARAN */}
        {dataPengeluaran.length > 0 && (() => {
          const [y, m] = bulanPilih.split('-');
          const nextBulan = new Date(y, parseInt(m), 1);
          const namaBulanSetor = nextBulan.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

          return (
            <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden">
              <div className="bg-red-50 border-b border-slate-300 p-4 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold text-red-900">2. Realisasi Pengeluaran (Setoran Klasis)</h2>
                  <p className="text-sm text-red-700">Data dari bulan: <span className="font-bold">{namaBulanSetor}</span></p>
                </div>
                <button onClick={() => setIsModalOpen(true)} className="bg-white border-2 border-red-600 text-red-700 font-bold py-1.5 px-4 rounded-md hover:bg-red-50 transition text-sm">
                  + Sisipan Pengeluaran
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                <table className="w-full text-left whitespace-nowrap text-sm border-collapse">
                  <thead className="bg-slate-100 text-slate-800">
                    <tr>
                      <th className="p-2 border border-slate-300 font-bold text-center w-12">No</th>
                      <th className="p-2 border border-slate-300 font-bold w-28">Tanggal</th>
                      <th className="p-2 border border-slate-300 font-bold">Kategori & Keterangan</th>
                      <th className="p-2 border border-slate-300 font-bold text-right w-40">Nominal</th>
                      <th className="p-2 border border-slate-300 font-bold text-center w-20">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataPengeluaran.map((item, index) => (
                      <tr key={item.id} className={`hover:bg-slate-50 ${item.isManual ? 'bg-amber-50' : ''}`}>
                        <td className="p-2 border border-slate-300 text-center">{index + 1}</td>
                        <td className="p-2 border border-slate-300">{item.tanggal}</td>
                        <td className="p-2 border border-slate-300">
                          <span className="font-medium">{item.kategori}</span>
                          <span className="text-slate-500 ml-2">{item.keterangan ? `- ${item.keterangan}` : ''}</span>
                          {item.isManual && <span className="ml-2 bg-amber-200 text-amber-800 text-[10px] px-2 py-0.5 rounded-full">Manual</span>}
                        </td>
                        <td className="p-2 border border-slate-300 text-right font-bold text-red-600">{formatRupiah(item.nominal)}</td>
                        <td className="p-2 border border-slate-300 text-center">
                          <button onClick={() => handleHapusPengeluaran(item.id)} className="bg-red-100 text-red-700 font-bold py-1 px-3 rounded text-xs hover:bg-red-200">Batal</button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-red-50 font-bold text-base">
                      <td className="p-3 border border-slate-300 text-right uppercase tracking-wider" colSpan="3">Total Riil Pengeluaran</td>
                      <td className="p-3 border border-slate-300 text-right text-red-700">{formatRupiah(grandTotalPengeluaran)}</td>
                      <td className="p-3 border border-slate-300"></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

      </div>

      {/* MODAL SISIPAN PENGELUARAN */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-lg shadow-xl overflow-hidden p-6">
            <h3 className="font-bold text-lg mb-4 border-b pb-2">Tambah Sisipan Pengeluaran</h3>
            <form onSubmit={handleTambahManual} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal</label>
                <input type="date" required value={manualData.tanggal} onChange={e => setManualData({...manualData, tanggal: e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategori / Uraian</label>
                <input type="text" required placeholder="Contoh: C05 - Ekstra Klasis" value={manualData.kategori} onChange={e => setManualData({...manualData, kategori: e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Keterangan Tambahan</label>
                <input type="text" placeholder="Opsional" value={manualData.keterangan} onChange={e => setManualData({...manualData, keterangan: e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nominal (Rp)</label>
                <input type="number" required placeholder="0" value={manualData.nominal} onChange={e => setManualData({...manualData, nominal: e.target.value})} className="w-full border p-2 rounded" />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-1/2 bg-slate-100 font-bold py-2 rounded text-slate-700 hover:bg-slate-200">Batal</button>
                <button type="submit" className="w-1/2 bg-red-600 font-bold text-white py-2 rounded hover:bg-red-700">Simpan Sisipan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default TarikDataSetoran;