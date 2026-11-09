import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function BukuPenerimaan() {
  const [semuaPenerimaan, setSemuaPenerimaan] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterBulan, setFilterBulan] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    // Menghapus orderBy 'tanggal' di Firestore query agar bisa kita sort manual berdasarkan jemaat & kategori
    const q = query(collection(db, 'transaksi'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let daftarTerima = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const jenis = String(data.jenis || data.tipe || data.kategori_transaksi || '').toLowerCase();
        
        if (jenis.includes('terima') || jenis.includes('pendapatan') || jenis.includes('masuk')) {
          const jumlah = Number(data.jumlah || data.nominal || data.total) || 0;
          
          const rawKategori = data.kategori || data.keterangan || '';
          const cleanKategori = String(rawKategori).replace(/^[A-Za-z0-9]+\s*-\s*/, '').trim();
          const jemaat = data.jemaat || data.namaJemaat || data.penyetor || '';
          
          const uraianLengkap = cleanKategori + (cleanKategori && jemaat ? ' - ' : '') + jemaat;

          daftarTerima.push({
            id: doc.id,
            ...data,
            jemaatAcu: jemaat.toLowerCase(), // Tambahan untuk mempermudah sorting
            kategoriAcu: (data.kategori || '').toLowerCase(), // Tambahan untuk mempermudah sorting
            jumlahTerima: jumlah,
            uraianTampil: uraianLengkap || '-'
          });
        }
      });

      setSemuaPenerimaan(daftarTerima);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
  
  const formatTanggalIndo = (tglString) => {
    if (!tglString) return '-';
    return new Date(tglString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const namaBulanCetak = new Date(filterBulan + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  
  // 1. Filter transaksi berdasarkan bulan
  // 2. Sort berdasarkan Jemaat (A-Z), lalu berdasarkan Kategori MA (A-Z)
  const penerimaanTampil = semuaPenerimaan
    .filter(t => t.tanggal && t.tanggal.startsWith(filterBulan))
    .sort((a, b) => {
       if (a.jemaatAcu < b.jemaatAcu) return -1;
       if (a.jemaatAcu > b.jemaatAcu) return 1;
       
       if (a.kategoriAcu < b.kategoriAcu) return -1;
       if (a.kategoriAcu > b.kategoriAcu) return 1;
       
       return 0;
    });

  const totalBulanIni = penerimaanTampil.reduce((acc, curr) => acc + curr.jumlahTerima, 0);

  if (loading) return <div className="text-center p-8 text-slate-500">Memuat Data Buku Penerimaan...</div>;

  return (
    <div className="animate-fade-in print:m-0 print:p-0">
      
      {/* TAMPILAN APLIKASI / WEB */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Buku Penerimaan</h2>
            <p className="text-sm text-slate-500">Diurutkan berdasarkan Mata Jemaat & Mata Anggaran</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="month" 
              value={filterBulan} 
              onChange={(e) => setFilterBulan(e.target.value)}
              className="border border-slate-300 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:ring-blue-500 w-full sm:w-auto"
            />
            <button onClick={() => window.print()} className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-2 rounded-lg text-sm shadow transition-colors whitespace-nowrap">
              Cetak Penerimaan
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-sm border-b border-slate-200">
                  <th className="p-4 w-40">Tanggal</th>
                  <th className="p-4">Uraian</th>
                  <th className="p-4 w-48 text-right">Jumlah (Rp)</th>
                  <th className="p-4 w-48">Penyetor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {penerimaanTampil.length === 0 ? (
                  <tr><td colSpan="4" className="text-center p-8 text-slate-400">Tidak ada penerimaan di bulan ini.</td></tr>
                ) : (
                  penerimaanTampil.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-600">{formatTanggalIndo(item.tanggal)}</td>
                      <td className="p-4 text-slate-800">{item.uraianTampil}</td>
                      <td className="p-4 text-right text-emerald-600 font-bold">{formatRupiah(item.jumlahTerima)}</td>
                      <td className="p-4 text-slate-400 italic"></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* TAMPILAN CETAK */}
      <div className="hidden print:block w-full text-black">
        <div className="mb-6 text-sm">
          <h1 className="text-center font-bold text-xl mb-4 uppercase tracking-wide">Buku Penerimaan</h1>
          <div className="flex justify-between items-end mb-2">
            <table className="text-left">
              <tbody>
                <tr><td className="pr-4 py-0.5">Jemaat</td><td>: GMIT KOA I</td></tr>
                <tr><td className="pr-4 py-0.5">Mata Jemaat</td><td>: ....................</td></tr>
                <tr><td className="pr-4 py-0.5">Bulan</td><td>: {namaBulanCetak.split(' ')[0]} {namaBulanCetak.split(' ')[1]}</td></tr>
              </tbody>
            </table>
            <table className="text-right">
              <tbody><tr><td className="py-0.5">Hal : ....................</td></tr></tbody>
            </table>
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-black print:text-[11px]">
          <thead className="table-header-group">
            <tr className="text-center font-bold">
              <th className="border border-black p-1 w-10" rowSpan="2">No</th>
              <th className="border border-black p-1 w-24" rowSpan="2">Tanggal</th>
              <th className="border border-black p-1" rowSpan="2">Uraian</th>
              <th className="border border-black p-1 w-28" rowSpan="2">Jumlah (Rp)</th>
              <th className="border border-black p-1" colSpan="2">Penyetor</th>
              <th className="border border-black p-1 w-24" rowSpan="2">Keterangan</th>
            </tr>
            <tr className="text-center font-bold">
              <th className="border border-black p-1 w-32">Nama</th>
              <th className="border border-black p-1 w-16">Tdt</th>
            </tr>
          </thead>
          <tbody>
            {penerimaanTampil.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black py-1 px-1 text-center">{index + 1}</td>
                <td className="border border-black py-1 px-1 text-center whitespace-nowrap">{formatTanggalIndo(item.tanggal)}</td>
                <td className="border border-black py-1 px-1">{item.uraianTampil}</td>
                <td className="border border-black py-1 px-1 text-right whitespace-nowrap">{formatRupiah(item.jumlahTerima)}</td>
                <td className="border border-black py-1 px-1"></td>
                <td className="border border-black py-1 px-1"></td>
                <td className="border border-black py-1 px-1">{item.catatan || ''}</td>
              </tr>
            ))}
            {penerimaanTampil.length > 0 && (
              <tr className="font-bold">
                <td colSpan="3" className="border border-black py-1 px-1 text-center uppercase">Total</td>
                <td className="border border-black py-1 px-1 text-right whitespace-nowrap">{formatRupiah(totalBulanIni)}</td>
                <td colSpan="3" className="border border-black py-1 px-1 bg-slate-200/50"></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default BukuPenerimaan;