import React, { useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 

// Fungsi untuk mengubah angka menjadi kata-kata (Terbilang)
const angkaTerbilang = (nilai) => {
  nilai = Math.abs(nilai);
  const huruf = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  let simpan = "";

  if (nilai < 12) {
    simpan = huruf[nilai];
  } else if (nilai < 20) {
    simpan = angkaTerbilang(nilai - 10) + " Belas";
  } else if (nilai < 100) {
    simpan = angkaTerbilang(Math.floor(nilai / 10)) + " Puluh " + angkaTerbilang(nilai % 10);
  } else if (nilai < 200) {
    simpan = "Seratus " + angkaTerbilang(nilai - 100);
  } else if (nilai < 1000) {
    simpan = angkaTerbilang(Math.floor(nilai / 100)) + " Ratus " + angkaTerbilang(nilai % 100);
  } else if (nilai < 2000) {
    simpan = "Seribu " + angkaTerbilang(nilai - 1000);
  } else if (nilai < 1000000) {
    simpan = angkaTerbilang(Math.floor(nilai / 1000)) + " Ribu " + angkaTerbilang(nilai % 1000);
  } else if (nilai < 1000000000) {
    simpan = angkaTerbilang(Math.floor(nilai / 1000000)) + " Juta " + angkaTerbilang(nilai % 1000000);
  }
  return simpan.trim();
};

const CetakDokumen = () => {
  const [bulanPilih, setBulanPilih] = useState('');
  const [arsipData, setArsipData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCariArsip = async (e) => {
    e.preventDefault();
    if (!bulanPilih) return alert('Pilih bulan arsip terlebih dahulu.');

    setLoading(true);
    setArsipData(null);
    
    try {
      const docRef = doc(db, 'arsip_setoran', bulanPilih);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setArsipData(docSnap.data());
      } else {
        alert('Data arsip bulan ini belum tersedia. Pastikan sudah disimpan melalui menu "Tarik Data".');
      }
    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat mencari dokumen cetak.');
    } finally {
      setLoading(false);
    }
  };

  const handleCetak = () => {
    window.print();
  };

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
  
  const formatBulan = (formatYYYYMM) => {
    if (!formatYYYYMM) return '';
    const [y, m] = formatYYYYMM.split('-');
    return new Date(y, parseInt(m) - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  };

  // Fungsi untuk membersihkan "A00 - " dari nama kategori
  const cleanUraian = (text) => {
    if (!text) return '';
    return text.replace(/^[A-Z]\d{2}\s*-\s*/i, '');
  };

  // Kalkulasi Pembulatan ke Atas (Kelipatan 500)
  const totalDiserahkan = arsipData?.total_pengeluaran || 0;
  const nilaiPembulatan = Math.ceil(totalDiserahkan / 500) * 500;

  // Nilai Selisih dari Rekonsiliasi (Jika ada)
  const selisih = arsipData?.rekonsiliasi_fisik?.selisih || 0;
  const teksSelisih = selisih > 0 ? formatRupiah(selisih) : '.........................';

  return (
    <div className="bg-slate-100 min-h-screen p-4 md:p-8 print:p-0 print:bg-white animate-fade-in">
      
      {/* PANEL KONTROL (SEMBUNYI SAAT DICETAK) */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8 border border-slate-200 print:hidden">
        <h1 className="text-2xl font-bold text-slate-800">Cetak Kwitansi Setoran Klasis</h1>
        <p className="text-slate-500 mt-1 mb-6">Cari arsip bulan yang telah disahkan, lalu cetak sebagai bukti fisik.</p>
        
        <div className="flex flex-col md:flex-row gap-4 items-end justify-between">
          <form onSubmit={handleCariArsip} className="flex gap-4 w-full md:w-2/3">
            <div className="w-full">
              <label className="block text-sm font-medium mb-1 text-slate-700">Pilih Bulan Arsip</label>
              <input 
                type="month" 
                required 
                value={bulanPilih} 
                onChange={(e) => setBulanPilih(e.target.value)} 
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button type="submit" disabled={loading} className="px-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition mt-6 whitespace-nowrap">
              {loading ? 'Mencari...' : 'Buka Dokumen'}
            </button>
          </form>

          {arsipData && (
            <button onClick={handleCetak} className="w-full md:w-auto px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-md shadow-lg transition flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
              Cetak Sekarang
            </button>
          )}
        </div>
      </div>

      {/* KERTAS DOKUMEN (TAMPIL DI LAYAR & SAAT DICETAK) */}
      {arsipData && (
        <div className="max-w-[210mm] min-h-[297mm] mx-auto bg-white p-10 md:p-12 shadow-xl print:shadow-none border border-slate-200 print:border-none relative">

          {/* JUDUL DOKUMEN */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold uppercase underline underline-offset-4 tracking-wide">Kwitansi Penyetoran</h1>
            <p className="text-sm font-medium mt-3 text-slate-800">
              Bulan Penerimaan: {formatBulan(arsipData.bulan_penerimaan)} &nbsp; | &nbsp; Bulan Setoran: {formatBulan(arsipData.bulan_setoran)}
            </p>
          </div>

          {/* BAGIAN A: RINCIAN PENDAPATAN */}
          <div className="mb-8">
            <h4 className="font-bold text-sm mb-2 uppercase text-slate-800">A. Rincian</h4>
            <table className="w-full text-sm border-collapse border border-slate-800">
              <thead className="bg-slate-100 print:bg-slate-100/50">
                <tr>
                  <th className="border border-slate-800 p-2 text-center w-10">No</th>
                  <th className="border border-slate-800 p-2 text-center">Uraian</th>
                  <th className="border border-slate-800 p-2 text-center w-32">Imanuel Koa (Rp)</th>
                  <th className="border border-slate-800 p-2 text-center w-32">Syalom Haususu (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {arsipData.rincian_pendapatan?.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-slate-800 p-2 text-center">{index + 1}</td>
                    <td className="border border-slate-800 p-2">{cleanUraian(item.uraian)}</td>
                    <td className="border border-slate-800 p-2 text-right">{item.koa > 0 ? formatRupiah(item.koa) : '-'}</td>
                    <td className="border border-slate-800 p-2 text-right">{item.haususu > 0 ? formatRupiah(item.haususu) : '-'}</td>
                  </tr>
                ))}
                <tr className="font-bold bg-slate-50 print:bg-slate-50/50">
                  <td className="border border-slate-800 p-2 text-right uppercase" colSpan="2">Total Rincian Penerimaan</td>
                  <td className="border border-slate-800 p-2 text-center" colSpan="2">
                    Rp {formatRupiah(arsipData.total_pendapatan)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* BAGIAN B: REALISASI SETORAN */}
          <div className="mb-6">
            <h4 className="font-bold text-sm mb-2 uppercase text-slate-800">B. Realisasi Setoran Ke Klasis</h4>
            <table className="w-full text-sm border-collapse border border-slate-800">
              <thead className="bg-slate-100 print:bg-slate-100/50">
                <tr>
                  <th className="border border-slate-800 p-2 text-center w-10">No</th>
                  <th className="border border-slate-800 p-2 text-center">Kategori / Keterangan</th>
                  <th className="border border-slate-800 p-2 text-center w-48">Nominal Setoran (Rp)</th>
                </tr>
              </thead>
              <tbody>
                {arsipData.rincian_pengeluaran?.map((item, index) => (
                  <tr key={index}>
                    <td className="border border-slate-800 p-2 text-center">{index + 1}</td>
                    <td className="border border-slate-800 p-2">
                      {cleanUraian(item.kategori)} {item.keterangan ? `- ${item.keterangan}` : ''}
                    </td>
                    <td className="border border-slate-800 p-2 text-right font-medium">
                      {formatRupiah(item.nominal)}
                    </td>
                  </tr>
                ))}
                
                {/* TOTAL UANG */}
                <tr className="font-bold text-base">
                  <td className="border border-slate-800 p-3 text-right uppercase tracking-wider" colSpan="2">Total Uang Yang Diserahkan</td>
                  <td className="border border-slate-800 p-3 text-right">Rp {formatRupiah(totalDiserahkan)}</td>
                </tr>
                
                {/* BARIS PEMBULATAN */}
                <tr className="font-bold text-base bg-slate-100 print:bg-slate-100/50">
                  <td className="border border-slate-800 p-3 text-right uppercase tracking-wider" colSpan="2">Pembulatan</td>
                  <td className="border border-slate-800 p-3 text-right">Rp {formatRupiah(nilaiPembulatan)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TERBILANG & CATATAN */}
          <div className="mb-8">
            <div className="text-sm font-bold italic bg-slate-50 border border-slate-300 p-3 mb-3 rounded-sm print:bg-transparent print:border-none print:p-0 print:mb-2">
              Terbilang : "{angkaTerbilang(nilaiPembulatan)} Rupiah"
            </div>
            
            <div className="text-sm text-slate-800">
              <span className="font-bold">Catatan :</span> selisih lebih Rp. {teksSelisih}
            </div>
          </div>

          {/* KOLOM TANDA TANGAN (SUDAH DISEJAJARKAN) */}
          <div className="mt-12 text-sm pt-8">
            <div className="flex justify-between w-full px-4 md:px-12">
              
              {/* Kolom Kiri */}
              <div className="text-center w-1/2 flex flex-col justify-end">
                {/* Teks invisible sebagai penyeimbang layout terhadap teks tanggal di sebelah kanan */}
                <p className="invisible">.... , ..... 2026</p>
                <p>Yang Menerima,</p>
                <div className="h-24"></div> {/* Ruang kosong untuk TTD */}
                <p className="font-bold uppercase">( ....................................... )</p>
              </div>

              {/* Kolom Kanan */}
              <div className="text-center w-1/2 flex flex-col justify-end">
                <p>.... , ..... 2026</p>
                <p>Yang Menyetor,</p>
                <div className="h-24"></div> {/* Ruang kosong untuk TTD */}
                <p className="font-bold uppercase">( ....................................... )</p>
              </div>

            </div>
          </div>

          {/* WATERMARK DIGITAL */}
          <div className="absolute bottom-4 left-0 right-0 text-[10px] text-slate-400 font-mono text-center">
            ID Arsip: {bulanPilih} | Terekam: {new Date(arsipData.waktu_simpan).toLocaleString('id-ID')}
          </div>

        </div>
      )}
    </div>
  );
};

export default CetakDokumen;