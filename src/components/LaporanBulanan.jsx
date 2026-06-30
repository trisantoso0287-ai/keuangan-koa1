import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const LaporanBulanan = () => {
  const [semuaTransaksi, setSemuaTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter default ke bulan dan tahun saat ini
  const today = new Date();
  const [filter, setFilter] = useState({
    bulan: String(today.getMonth() + 1).padStart(2, '0'),
    tahun: String(today.getFullYear())
  });

  const handleFilterChange = (e) => {
    setFilter({ ...filter, [e.target.name]: e.target.value });
  };

  useEffect(() => {
    const q = query(collection(db, 'transaksi'), orderBy('tanggal', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let daftarTransaksi = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        const jumlah = Number(data.jumlah || data.nominal || data.total) || 0;
        const jenis = String(data.jenis || data.tipe || data.kategori_transaksi || '').toLowerCase();
        
        const apakahMasuk = jenis.includes('terima') || jenis.includes('pendapatan') || jenis.includes('masuk');
        
        const rawKategori = String(data.kategori || data.keterangan || '');
        let noMA = '-';
        let namaMA = rawKategori;

        if (rawKategori.includes('-')) {
          const parts = rawKategori.split('-');
          noMA = parts[0].trim();
          namaMA = parts.slice(1).join('-').trim();
        }

        const jemaatName = String(data.jemaat || data.namaJemaat || data.penyetor || '').toLowerCase();

        daftarTransaksi.push({
          id: doc.id,
          ...data,
          jumlahAktual: jumlah,
          noMA,
          namaMA: namaMA || '-',
          apakahMasuk,
          jemaatName
        });
      });

      setSemuaTransaksi(daftarTransaksi);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ========================================================
  // PEMROSESAN DATA: Filter Bulan & Pemisahan Mata Jemaat
  // ========================================================
  const targetPrefix = `${filter.tahun}-${filter.bulan}`;
  const transaksiBulanIni = semuaTransaksi.filter(t => t.tanggal && t.tanggal.startsWith(targetPrefix));

  const rekapMapMasuk = {};
  const rekapMapKeluar = {};

  transaksiBulanIni.forEach(t => {
    const key = `${t.noMA}_${t.namaMA}`;
    // Tentukan mau masuk ke keranjang pendapatan atau pengeluaran
    const targetMap = t.apakahMasuk ? rekapMapMasuk : rekapMapKeluar;
    
    if (!targetMap[key]) {
      targetMap[key] = {
        id: t.noMA,
        nama: t.namaMA,
        koa: 0,
        haususu: 0,
        jumlah: 0
      };
    }

    // Deteksi Mata Jemaat berdasarkan kata kunci
    if (t.jemaatName.includes('haususu')) {
      targetMap[key].haususu += t.jumlahAktual;
    } else {
      // Default masuk ke Imanuel Koa jika tidak ada kata 'haususu'
      targetMap[key].koa += t.jumlahAktual;
    }
    
    targetMap[key].jumlah += t.jumlahAktual;
  });

  // Konversi ke array dan urutkan berdasarkan Nomor MA
  const rekapPendapatan = Object.values(rekapMapMasuk).sort((a, b) => a.id.localeCompare(b.id));
  const rekapPengeluaran = Object.values(rekapMapKeluar).sort((a, b) => a.id.localeCompare(b.id));

  // Hitung Total
  const totalPendapatan = rekapPendapatan.reduce((acc, curr) => acc + curr.jumlah, 0);
  const totalPengeluaran = rekapPengeluaran.reduce((acc, curr) => acc + curr.jumlah, 0);
  const saldoBulanIni = totalPendapatan - totalPengeluaran;

  const namaBulanPanjang = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  if (loading) return <div className="text-center p-8 text-slate-500">Memuat Laporan Bulanan...</div>;

  return (
    <div className="w-full animate-fade-in bg-white print:p-0 p-2">
      
      {/* =========================================
          ELEMEN NON-CETAK (Hanya tampil di layar)
          ========================================= */}
      <div className="print:hidden bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-bold text-slate-800">Filter Laporan Bulanan</h2>
          <button 
            onClick={() => window.print()}
            className="bg-slate-800 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-slate-900 flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            Cetak Laporan
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 max-w-sm">
          <select name="bulan" value={filter.bulan} onChange={handleFilterChange} className="p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500">
            {namaBulanPanjang.map((nama, index) => {
              if (index === 0) return null;
              const val = String(index).padStart(2, '0');
              return <option key={val} value={val}>{nama}</option>;
            })}
          </select>
          <input 
            type="number" 
            name="tahun" 
            value={filter.tahun} 
            onChange={handleFilterChange} 
            className="p-2 border rounded text-sm focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* =========================================
          ELEMEN CETAK
          ========================================= */}
      <div className="hidden print:block mb-6 text-center">
        <h1 className="text-xl font-bold uppercase mb-1">LAPORAN BULANAN JEMAAT KOA 1</h1>
        <p className="text-md font-semibold">Bulan: {namaBulanPanjang[parseInt(filter.bulan, 10)]} {filter.tahun}</p>
      </div>

      <div className="print:border-none border border-slate-200 rounded-lg overflow-x-auto print:overflow-visible">
        <table className="w-full text-left text-sm print:text-[11.5pt] border-collapse print:w-full">
          <thead>
            <tr className="border-y-2 border-black print:border-black bg-slate-100 print:bg-transparent">
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold" rowSpan="2">MA</th>
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold" rowSpan="2">URAIAN</th>
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold" colSpan="2">MATA JEMAAT</th>
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold" rowSpan="2">JUMLAH</th>
            </tr>
            <tr className="border-b-2 border-black print:border-black bg-slate-100 print:bg-transparent">
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold w-1/4">Imanuel Koa</th>
              <th className="p-2 border border-slate-300 print:border-black text-center font-bold w-1/4">Syalom Haususu</th>
            </tr>
          </thead>
          <tbody>
            
            {/* --- SEGMEN PENDAPATAN --- */}
            <tr className="bg-slate-50 print:bg-transparent">
              <td colSpan="5" className="p-2 border border-slate-300 print:border-black font-bold uppercase text-emerald-800 print:text-black">PENERIMAAN / PENDAPATAN</td>
            </tr>
            {rekapPendapatan.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center italic text-slate-500 border border-slate-300 print:border-black">Belum ada data penerimaan di bulan ini.</td></tr>
            ) : (
              rekapPendapatan.map((item, idx) => (
                <tr key={`masuk-${idx}`} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-center">{item.id}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black">{item.nama}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right">{item.koa > 0 ? item.koa.toLocaleString('id-ID') : '-'}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right">{item.haususu > 0 ? item.haususu.toLocaleString('id-ID') : '-'}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right font-semibold">
                    {item.jumlah.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))
            )}
            {/* Total Pendapatan */}
            <tr className="border-t border-black font-bold bg-emerald-50 print:bg-transparent">
              <td colSpan="4" className="p-2 px-3 border border-slate-300 print:border-black text-right uppercase">Total Penerimaan</td>
              <td className="p-2 px-3 border border-slate-300 print:border-black text-right text-emerald-700 print:text-black">
                {totalPendapatan.toLocaleString('id-ID')}
              </td>
            </tr>

            {/* --- SEGMEN PENGELUARAN --- */}
            <tr className="bg-slate-50 print:bg-transparent">
              <td colSpan="5" className="p-2 border border-slate-300 print:border-black font-bold uppercase text-rose-800 print:text-black mt-4">PENGELUARAN / BELANJA</td>
            </tr>
            {rekapPengeluaran.length === 0 ? (
              <tr><td colSpan="5" className="p-4 text-center italic text-slate-500 border border-slate-300 print:border-black">Belum ada data pengeluaran di bulan ini.</td></tr>
            ) : (
              rekapPengeluaran.map((item, idx) => (
                <tr key={`keluar-${idx}`} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-center">{item.id}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black">{item.nama}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right">{item.koa > 0 ? item.koa.toLocaleString('id-ID') : '-'}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right">{item.haususu > 0 ? item.haususu.toLocaleString('id-ID') : '-'}</td>
                  <td className="p-2 px-3 border border-slate-300 print:border-black text-right font-semibold">
                    {item.jumlah.toLocaleString('id-ID')}
                  </td>
                </tr>
              ))
            )}
            {/* Total Pengeluaran */}
            <tr className="border-t border-black font-bold bg-rose-50 print:bg-transparent">
              <td colSpan="4" className="p-2 px-3 border border-slate-300 print:border-black text-right uppercase">Total Pengeluaran</td>
              <td className="p-2 px-3 border border-slate-300 print:border-black text-right text-rose-700 print:text-black">
                {totalPengeluaran.toLocaleString('id-ID')}
              </td>
            </tr>

            {/* --- SURPLUS / DEFISIT (SELISIH) --- */}
            <tr className="border-t-2 border-black print:border-black font-black bg-blue-100 print:bg-slate-100">
              <td colSpan="4" className="p-3 px-3 border border-slate-300 print:border-black text-right uppercase">Selisih Bulan Ini (Penerimaan - Pengeluaran)</td>
              <td className="p-3 px-3 border border-slate-300 print:border-black text-right text-lg text-blue-900 print:text-black">
                {saldoBulanIni.toLocaleString('id-ID')}
              </td>
            </tr>

          </tbody>
        </table>
      </div>

      <div className="hidden print:flex justify-between mt-12 px-8">
        <div className="text-center">
          <p className="mb-20 text-sm">Mengetahui,</p>
          <p className="font-bold underline text-sm">Ketua Majelis Jemaat</p>
        </div>
        <div className="text-center">
          <p className="mb-20 text-sm">Koa, .............................. {filter.tahun}</p>
          <p className="font-bold underline text-sm">Bendahara Jemaat</p>
        </div>
      </div>

    </div>
  );
};

export default LaporanBulanan;