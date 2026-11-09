import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function BukuKasUmum() {
  const [semuaTransaksi, setSemuaTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [filterBulan, setFilterBulan] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    const q = query(collection(db, 'transaksi'), orderBy('tanggal', 'asc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let daftarTransaksi = [];
      let saldoBerjalan = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();
        
        const jumlah = Number(data.jumlah || data.nominal || data.total) || 0;
        const jenis = String(data.jenis || data.tipe || data.kategori_transaksi || '').toLowerCase();
        
        const apakahMasuk = jenis.includes('terima') || jenis.includes('pendapatan') || jenis.includes('masuk');
        
        if (apakahMasuk) {
          saldoBerjalan += jumlah;
        } else {
          saldoBerjalan -= jumlah;
        }

        const rawKategori = data.kategori || data.keterangan || '';
        const cleanKategori = String(rawKategori).replace(/^[A-Za-z0-9]+\s*-\s*/, '').trim();
        const jemaat = data.jemaat || data.namaJemaat || data.penyetor || '';
        
        const uraianLengkap = cleanKategori + (cleanKategori && jemaat ? ' - ' : '') + jemaat;

        daftarTransaksi.push({
          id: doc.id,
          ...data,
          masuk: apakahMasuk ? jumlah : 0,
          keluar: !apakahMasuk ? jumlah : 0,
          saldoSaatIni: saldoBerjalan,
          uraianTampil: uraianLengkap || '-'
        });
      });

      setSemuaTransaksi(daftarTransaksi);
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
  
  // Pisahkan transaksi bulan aktif dan hitung saldo bulan sebelumnya
  let saldoBulanSebelumnya = 0;
  const transaksiBulanIni = [];
  
  semuaTransaksi.forEach(t => {
    if (!t.tanggal) return;
    const tBulan = t.tanggal.substring(0, 7); // Ambil YYYY-MM
    
    if (tBulan < filterBulan) {
      // Akumulasi saldo historis
      saldoBulanSebelumnya += t.masuk;
      saldoBulanSebelumnya -= t.keluar;
    } else if (tBulan === filterBulan) {
      // Masukkan ke array bulan ini
      transaksiBulanIni.push(t);
    }
  });

  const ringkasanBulanIni = transaksiBulanIni.reduce((acc, curr) => {
    acc.masuk += curr.masuk;
    acc.keluar += curr.keluar;
    return acc;
  }, { masuk: 0, keluar: 0 });

  if (loading) return <div className="text-center p-8 text-slate-500">Memuat Data Buku Kas...</div>;

  return (
    <div className="animate-fade-in print:m-0 print:p-0">
      
      {/* TAMPILAN APLIKASI / WEB */}
      <div className="print:hidden space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-xl shadow-sm border border-slate-200 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Buku Kas Umum</h2>
            <p className="text-sm text-slate-500">Filter berdasarkan bulan transaksi</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input 
              type="month" 
              value={filterBulan} 
              onChange={(e) => setFilterBulan(e.target.value)}
              className="border border-slate-300 rounded-lg px-4 py-2 text-sm bg-slate-50 focus:ring-blue-500 w-full sm:w-auto"
            />
            <button onClick={() => window.print()} className="bg-blue-900 hover:bg-blue-950 text-white font-bold px-5 py-2 rounded-lg text-sm shadow transition-colors whitespace-nowrap">
              Cetak Kas
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Pemasukan Bulan Ini</p>
            <p className="text-2xl font-black text-emerald-950 mt-1">{formatRupiah(ringkasanBulanIni.masuk)}</p>
          </div>
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-xl shadow-sm">
            <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Pengeluaran Bulan Ini</p>
            <p className="text-2xl font-black text-rose-950 mt-1">{formatRupiah(ringkasanBulanIni.keluar)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold text-sm border-b border-slate-200">
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Uraian (Kategori & Jemaat)</th>
                  <th className="p-4 text-right">Debet (Masuk)</th>
                  <th className="p-4 text-right">Kredit (Keluar)</th>
                  <th className="p-4 text-right bg-slate-50">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                
                {/* BARIS SALDO BULAN SEBELUMNYA */}
                <tr className="bg-blue-50/30">
                  <td className="p-4 font-medium text-slate-500">-</td>
                  <td className="p-4 font-bold text-blue-900">Saldo Bulan Sebelumnya</td>
                  <td className="p-4 text-right">-</td>
                  <td className="p-4 text-right">-</td>
                  <td className="p-4 text-right font-bold text-blue-900 bg-slate-50/50">{formatRupiah(saldoBulanSebelumnya)}</td>
                </tr>

                {transaksiBulanIni.length === 0 ? (
                  <tr><td colSpan="5" className="text-center p-8 text-slate-400">Tidak ada transaksi di bulan ini.</td></tr>
                ) : (
                  transaksiBulanIni.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-600">{formatTanggalIndo(item.tanggal)}</td>
                      <td className="p-4 text-slate-800">{item.uraianTampil}</td>
                      <td className="p-4 text-right text-emerald-600 font-semibold">{item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
                      <td className="p-4 text-right text-rose-600 font-semibold">{item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
                      <td className="p-4 text-right font-bold text-slate-900 bg-slate-50/50">{formatRupiah(item.saldoSaatIni)}</td>
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
          <h1 className="text-center font-bold text-lg mb-6 uppercase">Buku Kas Umum</h1>
          <div className="flex justify-between items-end">
            <div>
              <table className="text-left">
                <tbody><tr><td className="pr-4 py-1">Bulan</td><td>: {namaBulanCetak.split(' ')[0]}</td></tr></tbody>
              </table>
            </div>
            <div>
              <table className="text-left">
                <tbody>
                  <tr><td className="pr-4 py-1">Nomor Halaman</td><td>: ....................</td></tr>
                  <tr><td className="pr-4 py-1">Paraf Bendahara</td><td>: ....................</td></tr>
                  <tr><td className="pr-4 py-1">Tahun</td><td>: {namaBulanCetak.split(' ')[1]}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <table className="w-full text-left border-collapse border border-black print:text-[11px]">
          <thead className="table-header-group">
            <tr className="text-center font-bold">
              <th className="border border-black p-1" rowSpan="2">No</th>
              <th className="border border-black p-1 w-24" rowSpan="2">Tgl</th>
              <th className="border border-black p-1" colSpan="2">Nomor Bukti</th>
              <th className="border border-black p-1" colSpan="2">Kode M.A.</th>
              <th className="border border-black p-1" rowSpan="2">Uraian</th>
              <th className="border border-black p-1 w-20" rowSpan="2">Debet</th>
              <th className="border border-black p-1 w-20" rowSpan="2">Kredit</th>
              <th className="border border-black p-1 w-24" rowSpan="2">Saldo</th>
            </tr>
            <tr className="text-center font-bold">
              <th className="border border-black p-1">Debet</th>
              <th className="border border-black p-1">Kredit</th>
              <th className="border border-black p-1">Debet</th>
              <th className="border border-black p-1">Kredit</th>
            </tr>
          </thead>
          <tbody>
            
            {/* BARIS SALDO BULAN SEBELUMNYA (CETAK) */}
            <tr>
               <td className="border border-black py-1 px-1 text-center"></td>
               <td className="border border-black py-1 px-1 text-center">-</td>
               <td className="border border-black py-1 px-1 text-center">-</td>
               <td className="border border-black py-1 px-1 text-center">-</td>
               <td className="border border-black py-1 px-1 text-center">-</td>
               <td className="border border-black py-1 px-1 text-center">-</td>
               <td className="border border-black py-1 px-1 font-bold">Saldo Bulan Sebelumnya</td>
               <td className="border border-black py-1 px-1 text-right">-</td>
               <td className="border border-black py-1 px-1 text-right">-</td>
               <td className="border border-black py-1 px-1 text-right font-bold">{formatRupiah(saldoBulanSebelumnya)}</td>
            </tr>

            {transaksiBulanIni.map((item, index) => (
              <tr key={item.id}>
                <td className="border border-black py-1 px-1 text-center">{index + 1}</td>
                <td className="border border-black py-1 px-1 text-center">{formatTanggalIndo(item.tanggal).replace(/20\d\d/g, '')}</td>
                <td className="border border-black py-1 px-1 text-center">{item.masuk > 0 ? (item.noBukti || '-') : '-'}</td>
                <td className="border border-black py-1 px-1 text-center">{item.keluar > 0 ? (item.noBukti || '-') : '-'}</td>
                <td className="border border-black py-1 px-1 text-center">{item.masuk > 0 ? (item.kodeMA || '-') : '-'}</td>
                <td className="border border-black py-1 px-1 text-center">{item.keluar > 0 ? (item.kodeMA || '-') : '-'}</td>
                <td className="border border-black py-1 px-1">{item.uraianTampil}</td>
                <td className="border border-black py-1 px-1 text-right">{item.masuk > 0 ? formatRupiah(item.masuk) : '-'}</td>
                <td className="border border-black py-1 px-1 text-right">{item.keluar > 0 ? formatRupiah(item.keluar) : '-'}</td>
                <td className="border border-black py-1 px-1 text-right font-semibold">{formatRupiah(item.saldoSaatIni)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

export default BukuKasUmum;