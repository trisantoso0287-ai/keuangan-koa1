import { useState, useEffect, useMemo } from 'react';
import TransactionForm from './TransactionForm';
import { collection, onSnapshot, doc, deleteDoc, query, addDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// Helper: Mendapatkan format YYYY-MM untuk bulan depan
const getNextMonthStr = (yyyy_mm) => {
  if (!yyyy_mm || yyyy_mm === "Tanggal Tidak Valid") return "";
  const [year, month] = yyyy_mm.split('-');
  const date = new Date(year, parseInt(month), 1); // parseInt(month) otomatis menunjuk ke bulan depan di JS
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

// Helper: Mendapatkan nama bulan singkat (Jan, Feb, Mar)
const getShortMonthName = (yyyy_mm) => {
  if (!yyyy_mm || yyyy_mm === "Tanggal Tidak Valid") return "";
  const [year, month] = yyyy_mm.split('-');
  const date = new Date(year, parseInt(month) - 1, 1);
  return date.toLocaleDateString('id-ID', { month: 'short' });
};

const ManajemenTransaksi = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTrx, setSelectedTrx] = useState(null);
  const [riwayatTransaksi, setRiwayatTransaksi] = useState([]);
  
  // State untuk UI & Modal
  const [isModalImportOpen, setIsModalImportOpen] = useState(false);
  const [pastedData, setPastedData] = useState('');
  const [isDropdownMenuOpen, setIsDropdownMenuOpen] = useState(false);
  const [mobileTrx, setMobileTrx] = useState(null);

  // ==========================================
  // STATE NAVIGASI BULAN & FILTER
  // ==========================================
  const [activeMonth, setActiveMonth] = useState('');
  const [filterJemaat, setFilterJemaat] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterKategori, setFilterKategori] = useState('');

  // ==========================================
  // AMBIL DATA DARI FIRESTORE
  // ==========================================
  useEffect(() => {
    const q = query(collection(db, "transaksi"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const dataFirestore = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRiwayatTransaksi(dataFirestore);
    });
    return () => unsubscribe();
  }, []);

  // ==========================================
  // LOGIKA PENGURUTAN & EKSTRAKSI BULAN UNTUK NAVIGASI
  // ==========================================
  const uniqueMonths = useMemo(() => {
    const months = new Set(riwayatTransaksi.map(trx => {
      const date = new Date(trx.tanggal);
      if (isNaN(date.getTime())) return "Tanggal Tidak Valid";
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }));
    // Urutkan dari bulan terbaru ke terlama (Descending)
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [riwayatTransaksi]);

  // Set bulan default ke bulan terbaru yang ada di database saat pertama kali load
  useEffect(() => {
    if (!activeMonth && uniqueMonths.length > 0) {
      setActiveMonth(uniqueMonths[0]);
    } else if (activeMonth && uniqueMonths.length > 0 && !uniqueMonths.includes(activeMonth)) {
      setActiveMonth(uniqueMonths[0]);
    }
  }, [uniqueMonths, activeMonth]);

  const currentIndex = uniqueMonths.indexOf(activeMonth);
  const handlePrevMonth = () => {
    if (currentIndex < uniqueMonths.length - 1) setActiveMonth(uniqueMonths[currentIndex + 1]);
  };
  const handleNextMonth = () => {
    if (currentIndex > 0) setActiveMonth(uniqueMonths[currentIndex - 1]);
  };

  // ==========================================
  // LOGIKA FILTER TRANSAKSI YANG DITAMPILKAN
  // ==========================================
  const displayedTransactions = useMemo(() => {
    return riwayatTransaksi
      .filter(trx => {
        const date = new Date(trx.tanggal);
        const trxMonth = isNaN(date.getTime()) ? "Tanggal Tidak Valid" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (trxMonth !== activeMonth) return false;
        if (filterJenis && trx.jenis !== filterJenis) return false;
        const jemaat = (trx.jemaat || '').toLowerCase();
        if (filterJemaat && !jemaat.includes(filterJemaat.toLowerCase())) return false;
        const kategori = (trx.kategori || '').toUpperCase();
        if (filterKategori && !kategori.startsWith(filterKategori)) return false;
        return true;
      })
      .sort((a, b) => {
        const dateDiff = new Date(b.tanggal) - new Date(a.tanggal);
        if (dateDiff !== 0) return dateDiff;
        const timeA = a.waktuUpdate?.seconds ? a.waktuUpdate.seconds : (new Date(a.waktuUpdate).getTime() || 0);
        const timeB = b.waktuUpdate?.seconds ? b.waktuUpdate.seconds : (new Date(b.waktuUpdate).getTime() || 0);
        return timeB - timeA;
      });
  }, [riwayatTransaksi, activeMonth, filterJenis, filterJemaat, filterKategori]);

  // ==========================================
  // LOGIKA KALKULASI RINGKASAN KHUSUS (TERIMA BULAN INI, KELUAR BULAN DEPAN)
  // ==========================================
  const ringkasanKeuangan = useMemo(() => {
    const nextMonth = getNextMonthStr(activeMonth);
    
    // Tentukan bulan terlama di database (karena uniqueMonths descending, ambil index terakhir)
    let earliestMonth = activeMonth;
    if (uniqueMonths.length > 0) {
      earliestMonth = uniqueMonths[uniqueMonths.length - 1];
    }

    let pemaBulanIni = 0;
    let pengeBulanDepan = 0;
    
    let totalPemaKumulatif = 0;
    let totalPengeKumulatif = 0;

    riwayatTransaksi.forEach(trx => {
      const date = new Date(trx.tanggal);
      const trxMonth = isNaN(date.getTime()) ? "Tanggal Tidak Valid" : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const nominal = Number(trx.nominal) || 0;

      // Evaluasi filter
      let matchFilter = true;
      if (filterJenis && trx.jenis !== filterJenis) matchFilter = false;
      const jemaat = (trx.jemaat || '').toLowerCase();
      if (filterJemaat && !jemaat.includes(filterJemaat.toLowerCase())) matchFilter = false;
      const kategori = (trx.kategori || '').toUpperCase();
      if (filterKategori && !kategori.startsWith(filterKategori)) matchFilter = false;

      if (matchFilter && trxMonth !== "Tanggal Tidak Valid") {
        
        // 1. Terima Bulan Ini
        if (trxMonth === activeMonth && trx.jenis === 'pendapatan') pemaBulanIni += nominal;
        
        // 2. Keluar Bulan Depan (Penyetoran ke Klasis dsb)
        if (trxMonth === nextMonth && trx.jenis === 'pengeluaran') pengeBulanDepan += nominal;

        // 3. Saldo Berjalan (Terima s/d Bulan Aktif dikurangi Keluar s/d Bulan Depan)
        if (trxMonth <= activeMonth && trx.jenis === 'pendapatan') totalPemaKumulatif += nominal;
        if (trxMonth <= nextMonth && trx.jenis === 'pengeluaran') totalPengeKumulatif += nominal;
      }
    });

    // Formatting Text Judul
    const actShort = getShortMonthName(activeMonth);
    const nxtShort = getShortMonthName(nextMonth);
    const earShort = getShortMonthName(earliestMonth);
    
    const sisa = pemaBulanIni - pengeBulanDepan;
    const saldoBerjalan = totalPemaKumulatif - totalPengeKumulatif;

    return {
      pemaBulanIni,
      pengeBulanDepan,
      sisa,
      saldoBerjalan,
      labelPema: `Terima (${actShort})`,
      labelPenge: `Keluar (${nxtShort})`,
      labelSisa: `Perhitungan Terima ${actShort} & Keluar ${nxtShort}`,
      labelKumulatif: earliestMonth === activeMonth 
        ? `Saldo Berjalan (${actShort})` 
        : `Saldo Berjalan (${earShort} - ${actShort})`
    };
  }, [riwayatTransaksi, activeMonth, filterJenis, filterJemaat, filterKategori, uniqueMonths]);

  const formatTanggalIndo = (tanggalString) => {
    const date = new Date(tanggalString);
    if (isNaN(date.getTime())) return tanggalString; 
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatBulanTahun = (bulanKunci) => {
    if (!bulanKunci || bulanKunci === "Tanggal Tidak Valid") return bulanKunci;
    const [year, month] = bulanKunci.split('-');
    const date = new Date(year, parseInt(month) - 1, 1); 
    return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // ==========================================
  // FUNGSI IMPOR EXCEL & HAPUS
  // ==========================================
  const prosesDataExcel = async () => {
    if (!pastedData.trim()) return alert("Teks kosong! Silakan paste data dari Excel.");
    const rows = pastedData.trim().split('\n');
    let berhasil = 0;
    let startIndex = rows[0].toLowerCase().includes('tanggal') ? 1 : 0;

    for (let i = startIndex; i < rows.length; i++) {
      if (rows[i].trim() === '') continue;
      const cols = rows[i].split('\t');
      
      if (cols.length >= 5) {
        const jenisTrx = cols[2].trim().toLowerCase();
        const nominalMurni = cols[4] ? Number(cols[4].trim().replace(/[^0-9]/g, '')) : 0; 
        const dataBaru = {
          tanggal: cols[0].trim(),
          jemaat: jenisTrx === 'pengeluaran' ? '' : cols[1].trim(),
          jenis: jenisTrx,
          kategori: cols[3].trim(),
          nominal: nominalMurni,
          keterangan: cols[5] ? cols[5].trim() : '',
          waktuUpdate: new Date()
        };
        try {
          await addDoc(collection(db, "transaksi"), dataBaru);
          berhasil++;
        } catch (error) { console.error("Error import:", error); }
      }
    }
    alert(`IMPOR SELESAI: ${berhasil} data transaksi berhasil diintegrasikan ke database!`);
    setPastedData('');
    setIsModalImportOpen(false);
    setIsDropdownMenuOpen(false);
  };

  const handleHapusTransaksi = async (id) => {
    const konfirmasi = window.confirm("Apakah Anda yakin ingin menghapus data transaksi ini secara permanen?");
    if (konfirmasi) {
      try { await deleteDoc(doc(db, "transaksi", String(id))); } 
      catch (error) { alert("Gagal menghapus data."); }
    }
  };

  const handleHapusSemua = async () => {
    if (riwayatTransaksi.length === 0) return alert("Database sudah kosong!");
    setIsDropdownMenuOpen(false);
    const konfirmasi1 = window.confirm(`AWAS! Anda akan menghapus SEMUA data transaksi. Yakin?`);
    if (konfirmasi1) {
      const konfirmasi2 = window.prompt("Ketik kata 'HAPUS' di bawah ini untuk konfirmasi:");
      if (konfirmasi2 === 'HAPUS') {
        try {
          for (const trx of riwayatTransaksi) {
            await deleteDoc(doc(db, "transaksi", String(trx.id)));
          }
          alert("Seluruh data transaksi berhasil dikosongkan!");
        } catch (error) { alert("Gagal menghapus beberapa data."); }
      }
    }
  };

  const unduhTemplateExcel = () => {
    setIsDropdownMenuOpen(false);
    const tableHTML = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr><th style="background-color:#f8fafc;">Tanggal</th><th style="background-color:#f8fafc;">Mata Jemaat</th><th style="background-color:#f8fafc;">Jenis (pendapatan/pengeluaran)</th><th style="background-color:#f8fafc;">Kode MA</th><th style="background-color:#f8fafc;">Nominal</th><th style="background-color:#f8fafc;">Keterangan</th></tr><tr><td>2026-06-29</td><td>Imanuel Koa</td><td>pendapatan</td><td>A01 - SGP</td><td>1550000</td><td>Setoran Minggu 4</td></tr></table></body></html>`;
    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Template_Input_Transaksi.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isFormOpen) {
    return <TransactionForm initialData={selectedTrx} onClose={() => { setIsFormOpen(false); setSelectedTrx(null); }} />;
  }

  return (
    <div className="w-full animate-fade-in bg-white p-4 md:p-6 rounded-lg shadow-sm border border-slate-200 relative">
      
      {/* HEADER & DROPDOWN OPSI */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Manajemen Transaksi</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola, saring, dan navigasikan data per bulan.</p>
        </div>
        <div className="relative">
          <button onClick={() => setIsDropdownMenuOpen(!isDropdownMenuOpen)} className="bg-slate-100 text-slate-700 px-4 py-2 rounded-md text-sm font-bold hover:bg-slate-200 flex items-center gap-2 transition-colors">
            Opsi Lanjutan
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          {isDropdownMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-md shadow-xl z-20 flex flex-col overflow-hidden">
              <button onClick={() => setIsModalImportOpen(true)} className="text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 text-emerald-700">📥 Impor Excel</button>
              <button onClick={unduhTemplateExcel} className="text-left px-4 py-3 text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 text-blue-700 border-t border-slate-100">📄 Unduh Template</button>
              <button onClick={handleHapusSemua} className="text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100">⚠️ Hapus Semua Data</button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER & NAVIGASI BULAN */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mb-6 space-y-4">
        <div className="flex justify-between items-center bg-white p-2 rounded-md shadow-sm border border-slate-200">
          <button 
            onClick={handlePrevMonth} 
            disabled={currentIndex === uniqueMonths.length - 1 || uniqueMonths.length === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-blue-100 text-blue-700 font-bold rounded disabled:opacity-30 transition-colors"
          >
            &laquo; Bulan Lalu
          </button>
          <div className="text-lg font-black text-slate-800 uppercase tracking-wide">
            {activeMonth ? formatBulanTahun(activeMonth) : "Data Kosong"}
          </div>
          <button 
            onClick={handleNextMonth} 
            disabled={currentIndex === 0 || uniqueMonths.length === 0}
            className="px-4 py-2 bg-slate-100 hover:bg-blue-100 text-blue-700 font-bold rounded disabled:opacity-30 transition-colors"
          >
            Bulan Depan &raquo;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer">
            <option value="">Semua Jenis (Masuk & Keluar)</option>
            <option value="pendapatan">Hanya Pendapatan</option>
            <option value="pengeluaran">Hanya Pengeluaran</option>
          </select>
          <select value={filterJemaat} onChange={(e) => setFilterJemaat(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer">
            <option value="">Semua Wilayah / Jemaat</option>
            <option value="koa">Imanuel Koa</option>
            <option value="haususu">Syalom Haususu</option>
          </select>
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} className="w-full p-2 border border-slate-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700 cursor-pointer">
            <option value="">Semua Kategori (A, C, D, E)</option>
            <option value="A">Kategori A - (Penerimaan)</option>
            <option value="C">Kategori C - (Pengeluaran)</option>
            <option value="D">Kategori D - (Pengeluaran)</option>
            <option value="E">Kategori E - (Lain-lain)</option>
          </select>
        </div>
      </div>

      {/* 4 KOTAK RINGKASAN KHUSUS (Penerimaan Bulan Ini VS Pengeluaran Bulan Depan) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        
        {/* Kotak 1: Penerimaan Bulan Ini */}
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-lg flex flex-col justify-center shadow-sm">
          <span className="text-xs md:text-sm font-bold text-emerald-700 mb-1">{ringkasanKeuangan.labelPema}</span>
          <span className="text-xl md:text-2xl font-black text-emerald-600">Rp {ringkasanKeuangan.pemaBulanIni.toLocaleString('id-ID')}</span>
        </div>
        
        {/* Kotak 2: Pengeluaran Bulan Depan */}
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg flex flex-col justify-center shadow-sm">
          <span className="text-xs md:text-sm font-bold text-red-700 mb-1">{ringkasanKeuangan.labelPenge}</span>
          <span className="text-xl md:text-2xl font-black text-red-600">Rp {ringkasanKeuangan.pengeBulanDepan.toLocaleString('id-ID')}</span>
        </div>
        
        {/* Kotak 3: Selisih (Sisa) */}
        <div className={`border p-4 rounded-lg flex flex-col justify-center shadow-sm ${ringkasanKeuangan.sisa < 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
          <span className={`text-xs md:text-sm font-bold leading-tight mb-1 ${ringkasanKeuangan.sisa < 0 ? 'text-orange-700' : 'text-blue-700'}`}>
            {ringkasanKeuangan.labelSisa}
          </span>
          <span className={`text-xl md:text-2xl font-black ${ringkasanKeuangan.sisa < 0 ? 'text-orange-600' : 'text-blue-600'}`}>
            Rp {ringkasanKeuangan.sisa.toLocaleString('id-ID')}
          </span>
        </div>

        {/* Kotak 4: Saldo Berjalan (Kumulatif) */}
        <div className={`border p-4 rounded-lg flex flex-col justify-center shadow-sm ${ringkasanKeuangan.saldoBerjalan < 0 ? 'bg-rose-50 border-rose-300' : 'bg-indigo-50 border-indigo-200'}`}>
          <span className={`text-xs md:text-sm font-bold leading-tight mb-1 ${ringkasanKeuangan.saldoBerjalan < 0 ? 'text-rose-700' : 'text-indigo-700'}`}>
            {ringkasanKeuangan.labelKumulatif}
          </span>
          <span className={`text-xl md:text-2xl font-black ${ringkasanKeuangan.saldoBerjalan < 0 ? 'text-rose-600' : 'text-indigo-600'}`}>
            Rp {ringkasanKeuangan.saldoBerjalan.toLocaleString('id-ID')}
          </span>
        </div>

      </div>

      {/* TAMPILAN DESKTOP (TABEL) */}
      <div className="hidden md:block overflow-x-auto pb-20">
        <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
          <thead className="bg-slate-100 text-slate-800">
            <tr>
              <th className="p-3 font-bold border border-slate-200">Tanggal</th>
              <th className="p-3 font-bold border border-slate-200">Mata Jemaat</th>
              <th className="p-3 font-bold border border-slate-200">Kategori & Keterangan</th>
              <th className="p-3 font-bold border border-slate-200 text-right">Nominal</th>
              <th className="p-3 font-bold border border-slate-200 text-center w-32">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {displayedTransactions.length > 0 ? (
              displayedTransactions.map((trx, index) => (
                <tr key={trx.id} className={`border-b border-slate-200 hover:bg-blue-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                  <td className="p-3 text-slate-700 font-medium">{formatTanggalIndo(trx.tanggal)}</td>
                  <td className="p-3 capitalize">{trx.jemaat || '-'}</td>
                  <td className="p-3">
                    <span className="font-semibold">{trx.kategori}</span>
                    {trx.keterangan && <span className="text-slate-500 block text-xs mt-0.5 whitespace-normal">{trx.keterangan}</span>}
                  </td>
                  <td className={`p-3 text-right font-bold ${trx.jenis === 'pendapatan' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {trx.jenis === 'pendapatan' ? '+' : '-'} Rp {trx.nominal.toLocaleString('id-ID')}
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <button onClick={() => { setSelectedTrx(trx); setIsFormOpen(true); }} className="text-blue-600 hover:bg-blue-100 font-bold bg-blue-50 px-3 py-1.5 rounded transition-colors">Edit</button>
                      <button onClick={() => handleHapusTransaksi(trx.id)} className="text-red-600 hover:bg-red-100 font-bold bg-red-50 px-3 py-1.5 rounded transition-colors">Hapus</button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="p-8 text-center text-slate-400 font-medium bg-slate-50">
                  Tidak ada transaksi yang cocok dengan filter pada bulan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* TAMPILAN MOBILE (KARTU / LIST) */}
      <div className="block md:hidden pb-24">
        <div className="flex flex-col gap-3">
          {displayedTransactions.length > 0 ? (
            displayedTransactions.map((trx) => (
              <div 
                key={trx.id} 
                onClick={() => setMobileTrx(trx)}
                className="bg-white border border-slate-200 p-4 rounded-lg shadow-sm active:scale-[0.98] transition-transform cursor-pointer relative"
              >
                <div className="flex justify-between items-start mb-2 border-b border-slate-100 pb-2">
                  <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{formatTanggalIndo(trx.tanggal)}</span>
                  <span className={`font-black text-lg ${trx.jenis === 'pendapatan' ? 'text-emerald-600' : 'text-red-600'}`}>
                    {trx.jenis === 'pendapatan' ? '+' : '-'} {trx.nominal.toLocaleString('id-ID')}
                  </span>
                </div>
                <p className="font-bold text-slate-800 text-sm leading-tight mb-1">{trx.kategori}</p>
                <p className="text-xs font-medium text-blue-600 mb-1">{trx.jemaat || 'Pengeluaran / Umum'}</p>
                {trx.keterangan && <p className="text-xs text-slate-500 italic">{trx.keterangan}</p>}
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-slate-400 border border-dashed border-slate-300 rounded-lg">
              Data tidak ditemukan
            </div>
          )}
        </div>
      </div>

      {/* FAB: TOMBOL INPUT BARU MELAYANG */}
      <button 
        onClick={() => { setSelectedTrx(null); setIsFormOpen(true); }} 
        className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-14 h-14 bg-blue-800 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-blue-900 z-40 hover:scale-105 transition-transform"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
      </button>

      {/* MODAL: AKSI MOBILE */}
      {mobileTrx && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-t-2xl md:rounded-xl shadow-xl flex flex-col animate-fade-in p-5">
            <h3 className="font-bold text-slate-800 mb-1 text-center">Opsi Transaksi</h3>
            <p className="text-xs text-slate-500 text-center mb-6">{mobileTrx.kategori} ({mobileTrx.nominal.toLocaleString('id-ID')})</p>
            <button onClick={() => { setSelectedTrx(mobileTrx); setIsFormOpen(true); setMobileTrx(null); }} className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold py-3 rounded-lg mb-3 transition-colors flex items-center justify-center gap-2">✏️ Edit Data</button>
            <button onClick={() => { handleHapusTransaksi(mobileTrx.id); setMobileTrx(null); }} className="w-full bg-red-50 text-red-700 hover:bg-red-100 font-bold py-3 rounded-lg mb-3 transition-colors flex items-center justify-center gap-2">🗑️ Hapus Data</button>
            <button onClick={() => setMobileTrx(null)} className="w-full bg-slate-100 text-slate-600 font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors">Batal</button>
          </div>
        </div>
      )}

      {/* MODAL: FORM IMPOR EXCEL */}
      {isModalImportOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-3xl rounded-lg shadow-xl flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-emerald-50 rounded-t-lg">
              <h3 className="font-bold text-lg text-emerald-900">Impor Transaksi (Copy-Paste)</h3>
              <button onClick={() => setIsModalImportOpen(false)} className="text-slate-500 hover:text-red-500 font-bold text-xl">&times;</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <textarea rows="8" className="w-full p-3 border-2 border-emerald-300 rounded font-mono text-sm whitespace-pre" placeholder="Paste data transaksi dari Excel Anda di sini..." value={pastedData} onChange={(e) => setPastedData(e.target.value)}></textarea>
            </div>
            <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-lg">
              <button onClick={() => setIsModalImportOpen(false)} className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded transition-colors">Batal</button>
              <button onClick={prosesDataExcel} className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors">Proses Data</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ManajemenTransaksi;