import React, { useState, useMemo, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; 

const KontribusiJemaat = () => {
  const [tahunPilih, setTahunPilih] = useState(new Date().getFullYear().toString());
  const [loading, setLoading] = useState(false);
  
  // State Data Mentah & Dropdown Dinamis
  const [rawData, setRawData] = useState([]);
  const [kategoriTersedia, setKategoriTersedia] = useState([]);
  const [kategoriPilih, setKategoriPilih] = useState('');
  
  // State Matriks Final
  const [dataTahunan, setDataTahunan] = useState([]);

  // State Evaluasi Target Jemaat
  const [targetDisplay, setTargetDisplay] = useState('');
  const [targetValue, setTargetValue] = useState(0);
  const [isTargetLocked, setIsTargetLocked] = useState(false);

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // 1. FUNGSI TARIK SEMUA DATA PENDAPATAN 1 TAHUN
  const handleTarikDataTahun = async (e) => {
    e.preventDefault();
    if (!tahunPilih) return alert('Mohon isi tahun.');

    setLoading(true);
    setRawData([]);
    setKategoriTersedia([]);
    setKategoriPilih('');
    setDataTahunan([]);
    // Target Keseluruhan sengaja tidak di-reset agar tersimpan saat tarik data ulang

    try {
      const transaksiRef = collection(db, 'transaksi');
      const startDate = `${tahunPilih}-01-01`;
      const endDate = `${tahunPilih}-12-31`;

      const q = query(
        transaksiRef,
        where('jenis', '==', 'pendapatan'),
        where('tanggal', '>=', startDate),
        where('tanggal', '<=', endDate)
      );

      const snap = await getDocs(q);
      const fetchedData = [];
      const uniqueCategories = new Set();

      snap.forEach((doc) => {
        const data = doc.data();
        fetchedData.push(data);
        
        // Kumpulkan semua nama kategori yang ada (bersihkan spasi ekstra)
        if (data.kategori) {
          uniqueCategories.add(data.kategori.trim());
        }
      });

      if (fetchedData.length === 0) {
        alert(`Tidak ada data pendapatan ditemukan untuk tahun ${tahunPilih}`);
        setLoading(false);
        return;
      }

      // Urutkan kategori sesuai abjad
      const sortedCategories = Array.from(uniqueCategories).sort();
      setRawData(fetchedData);
      setKategoriTersedia(sortedCategories);
      setKategoriPilih(sortedCategories[0]); // Otomatis pilih kategori pertama

    } catch (error) {
      console.error(error);
      alert('Terjadi kesalahan saat menarik data.');
    } finally {
      setLoading(false);
    }
  };

  // 2. FUNGSI MEMBENTUK MATRIKS SETIAP KALI DROPDOWN KATEGORI BERUBAH
  useEffect(() => {
    if (rawData.length > 0 && kategoriPilih) {
      let rekap = Array.from({ length: 12 }, (_, i) => ({
        idBulan: i + 1,
        nama: namaBulan[i],
        koa: 0,
        haususu: 0
      }));

      rawData.forEach((data) => {
        if (data.kategori && data.kategori.trim() === kategoriPilih) {
          const tanggal = data.tanggal || ''; 
          const jemaat = (data.jemaat || '').toLowerCase();
          const nominal = Number(data.nominal || 0);
          const bulanIndex = parseInt(tanggal.split('-')[1]) - 1;
          
          if (bulanIndex >= 0 && bulanIndex < 12) {
            if (jemaat.includes('koa')) rekap[bulanIndex].koa += nominal;
            else if (jemaat.includes('haususu')) rekap[bulanIndex].haususu += nominal;
            else rekap[bulanIndex].koa += nominal; // Fallback default
          }
        }
      });

      setDataTahunan(rekap);
    }
  }, [kategoriPilih, rawData]);

  // Handle Input Target Keseluruhan dengan Format Ribuan
  const handleTargetChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    
    if (!rawValue) {
        setTargetDisplay('');
        setTargetValue(0);
        return;
    }

    const numValue = parseInt(rawValue, 10);
    setTargetValue(numValue);
    setTargetDisplay(new Intl.NumberFormat('id-ID').format(numValue));
  };

  // Kalkulasi Grand Total
  const grandTotal = useMemo(() => {
    let totalKoa = 0; let totalHaususu = 0;
    dataTahunan.forEach(item => { totalKoa += item.koa; totalHaususu += item.haususu; });
    return { totalKoa, totalHaususu, totalSemua: totalKoa + totalHaususu };
  }, [dataTahunan]);

  // Kalkulasi Evaluasi Beban
  const targetPerJemaat = targetValue / 2;
  const selisihKoa = grandTotal.totalKoa - targetPerJemaat;
  const selisihHaususu = grandTotal.totalHaususu - targetPerJemaat;

  const formatRupiah = (angka) => new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);

  // 3. FUNGSI SIMPAN ARSIP
  const handleSimpanArsip = async () => {
    if (dataTahunan.length === 0) return;
    const idArsip = `${tahunPilih}_${kategoriPilih.replace(/\s+/g, '')}`;

    if (!window.confirm(`Simpan matriks ${kategoriPilih} tahun ${tahunPilih} ke database?`)) return;

    try {
      await setDoc(doc(db, 'arsip_kontribusi_tahunan', idArsip), {
        tahun: tahunPilih,
        kategori: kategoriPilih,
        matriks: dataTahunan,
        total_koa: grandTotal.totalKoa,
        total_haususu: grandTotal.totalHaususu,
        grand_total: grandTotal.totalSemua,
        target_keseluruhan: targetValue,
        waktu_simpan: new Date().toISOString()
      });
      alert('Arsip Kontribusi Tahunan berhasil disimpan!');
    } catch (error) {
      console.error(error);
      alert('Gagal menyimpan arsip.');
    }
  };

  // 4. FUNGSI EKSPOR EXCEL (XLS)
  const unduhExcel = () => {
    let tableHTML = `
      <html xmlns:x="urn:schemas-microsoft-com:office:excel">
        <head>
          <meta charset="utf-8">
          <style>
            th { background-color: #f1f5f9; font-weight: bold; border: 1px solid #000; padding: 5px; }
            td { border: 1px solid #000; padding: 5px; }
          </style>
        </head>
        <body>
          <h2>Matriks Kontribusi - ${kategoriPilih} (${tahunPilih})</h2>
          <table>
            <thead>
              <tr>
                <th>No</th>
                <th>Bulan</th>
                <th>Imanuel Koa</th>
                <th>Syalom Haususu</th>
                <th>Total Bulanan</th>
              </tr>
            </thead>
            <tbody>
    `;

    dataTahunan.forEach((item, index) => {
      const totalBulan = item.koa + item.haususu;
      tableHTML += `
        <tr>
          <td align="center">${index + 1}</td>
          <td>${item.nama}</td>
          <td align="right">${item.koa}</td>
          <td align="right">${item.haususu}</td>
          <td align="right"><b>${totalBulan}</b></td>
        </tr>
      `;
    });

    tableHTML += `
            <tr style="font-weight:bold; background-color:#e2e8f0;">
              <td colspan="2" align="right">Total Kontribusi ${tahunPilih}</td>
              <td align="right">${grandTotal.totalKoa}</td>
              <td align="right">${grandTotal.totalHaususu}</td>
              <td align="right">${grandTotal.totalSemua}</td>
            </tr>
          </tbody>
        </table>
        
        <br><br>
        
        <h3>EVALUASI BEBAN JEMAAT / WILAYAH (${kategoriPilih} - ${tahunPilih})</h3>
        <table>
          <thead style="background-color: #f3f4f6;">
            <tr>
              <th>Mata Jemaat</th>
              <th>Beban Target (50%)</th>
              <th>Total Realisasi</th>
              <th>Selisih (Surplus / Kurang)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Imanuel Koa</td>
              <td align="right">${targetPerJemaat}</td>
              <td align="right">${grandTotal.totalKoa}</td>
              <td align="right">${selisihKoa}</td>
            </tr>
            <tr>
              <td>Syalom Haususu</td>
              <td align="right">${targetPerJemaat}</td>
              <td align="right">${grandTotal.totalHaususu}</td>
              <td align="right">${selisihHaususu}</td>
            </tr>
          </tbody>
        </table>

      </body></html>
    `;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Matriks_Kontribusi_${tahunPilih}_${kategoriPilih.replace(/\s+/g, '_')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-6 bg-slate-50 min-h-screen animate-fade-in relative">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header & Filter Tahun */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Rekap Kontribusi Dinamis</h1>
              <p className="text-slate-500 mt-1">Tarik setahun, pilih kategori (A19, A08, dll), simpan & ekspor.</p>
            </div>
            
            {dataTahunan.length > 0 && (
              <div className="flex gap-2">
                <button onClick={unduhExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  XLS
                </button>
                <button onClick={handleSimpanArsip} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md shadow-sm transition flex items-center gap-2">
                  💾 Simpan Arsip
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleTarikDataTahun} className="flex gap-4 items-end">
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium mb-1 text-slate-700">Pilih Tahun Transaksi</label>
              <input 
                type="number" min="2020" max="2100" required 
                value={tahunPilih} 
                onChange={(e) => setTahunPilih(e.target.value)} 
                className="w-full border border-slate-300 rounded-md p-2 outline-none focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button type="submit" disabled={loading} className="w-full md:w-1/4 bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 rounded-md transition">
              {loading ? 'Memproses...' : 'Tarik Data Dasar'}
            </button>
          </form>
        </div>

        {kategoriTersedia.length > 0 && (
          <div className="bg-indigo-50 p-6 rounded-lg shadow-sm border border-indigo-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-2/3">
              <label className="block text-sm font-bold mb-1 text-indigo-900">Pilih Kategori Kontribusi (Otomatis terdeteksi)</label>
              <select 
                value={kategoriPilih} 
                onChange={(e) => setKategoriPilih(e.target.value)}
                className="w-full border border-indigo-300 rounded-md p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-800 shadow-sm"
              >
                {kategoriTersedia.map((kat, index) => (
                  <option key={index} value={kat}>{kat}</option>
                ))}
              </select>
            </div>
            <div className="w-full md:w-1/3 text-right">
               <p className="text-xs text-indigo-700 font-medium">*Mengganti opsi akan langsung mengubah matriks di bawah tanpa perlu *loading* lagi.</p>
            </div>
          </div>
        )}

        {dataTahunan.length > 0 && (
          <div className="space-y-6">
            
            {/* TABEL MATRIKS 12 BULAN */}
            <div className="bg-white rounded-lg shadow-sm border border-slate-300 overflow-hidden w-full">
                <div className="bg-white border-b border-slate-300 p-4">
                <h2 className="text-lg font-bold text-slate-800">Matriks {kategoriPilih} - Tahun {tahunPilih}</h2>
                </div>
                
                <div className="overflow-x-auto p-4">
                <table className="w-full text-left whitespace-nowrap text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-800">
                    <tr>
                        <th className="p-3 border border-slate-300 font-bold text-center w-12" rowSpan="2">No</th>
                        <th className="p-3 border border-slate-300 font-bold text-center w-40" rowSpan="2">Bulan</th>
                        <th className="p-2 border border-slate-300 font-bold text-center" colSpan="2">Mata Jemaat</th>
                        <th className="p-3 border border-slate-300 font-bold text-center w-48" rowSpan="2">Total Bulanan</th>
                    </tr>
                    <tr>
                        <th className="p-2 border border-slate-300 font-semibold text-center w-48">Imanuel Koa</th>
                        <th className="p-2 border border-slate-300 font-semibold text-center w-48">Syalom Haususu</th>
                    </tr>
                    </thead>
                    <tbody>
                    {dataTahunan.map((item, index) => {
                        const totalBulan = item.koa + item.haususu;
                        const isAdaData = totalBulan > 0;
                        
                        return (
                        <tr key={index} className={`hover:bg-slate-50 transition-colors ${isAdaData ? 'text-slate-800' : 'text-slate-400'}`}>
                            <td className="p-2 border border-slate-300 text-center">{index + 1}</td>
                            <td className="p-2 border border-slate-300 font-medium">{item.nama}</td>
                            <td className="p-2 border border-slate-300 text-right">{item.koa > 0 ? formatRupiah(item.koa) : '-'}</td>
                            <td className="p-2 border border-slate-300 text-right">{item.haususu > 0 ? formatRupiah(item.haususu) : '-'}</td>
                            <td className={`p-2 border border-slate-300 text-right font-bold ${isAdaData ? 'text-blue-600' : ''}`}>
                            {isAdaData ? formatRupiah(totalBulan) : '-'}
                            </td>
                        </tr>
                        );
                    })}
                    <tr className="bg-slate-100 text-base">
                        <td className="p-3 border border-slate-300 text-right font-bold uppercase tracking-wider" colSpan="2">Total Kontribusi Tahunan</td>
                        <td className="p-3 border border-slate-300 text-right font-bold text-indigo-700">{grandTotal.totalKoa > 0 ? formatRupiah(grandTotal.totalKoa) : '-'}</td>
                        <td className="p-3 border border-slate-300 text-right font-bold text-purple-700">{grandTotal.totalHaususu > 0 ? formatRupiah(grandTotal.totalHaususu) : '-'}</td>
                        <td className="p-3 border border-slate-300 text-right font-black text-slate-800 bg-slate-200">{formatRupiah(grandTotal.totalSemua)}</td>
                    </tr>
                    </tbody>
                </table>
                </div>
            </div>

            {/* PANEL EVALUASI TARGET KESELURUHAN */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-300 w-full">
                <h3 className="font-bold text-indigo-900 mb-5 border-b border-slate-200 pb-3 text-lg">
                    Evaluasi Beban Jemaat/Wilayah - Kategori {kategoriPilih}
                </h3>
                
                <div className="mb-6 bg-slate-50 p-4 rounded-md border border-slate-200 inline-block w-full md:w-2/3 lg:w-1/2">
                    <label className="block text-sm font-bold mb-2 text-slate-700">Target Keseluruhan (Rp)</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={targetDisplay}
                            onChange={handleTargetChange}
                            disabled={isTargetLocked}
                            placeholder="Cth: 1.000.000"
                            className={`w-full border border-slate-300 rounded-md p-3 outline-none focus:ring-2 focus:ring-indigo-500 text-lg font-semibold shadow-inner transition-colors ${isTargetLocked ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-white text-slate-800'}`}
                        />
                        <button
                            type="button"
                            onClick={() => setIsTargetLocked(!isTargetLocked)}
                            className={`px-6 py-3 rounded-md font-bold text-white shadow-sm transition whitespace-nowrap ${isTargetLocked ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                        >
                            {isTargetLocked ? 'Edit' : 'Simpan'}
                        </button>
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                        {isTargetLocked ? '*Target dikunci agar nilainya tidak hilang saat Anda melakukan Tarik Data.' : '*Ketik nominal lalu klik Simpan untuk mengunci target evaluasi.'}
                    </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="p-5 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
                        <div className="font-bold text-slate-800 text-center border-b border-slate-200 pb-2 mb-4 text-lg">Imanuel Koa</div>
                        <div className="flex justify-between text-base mb-2">
                            <span className="text-slate-600">Beban (50%):</span>
                            <span className="font-bold text-slate-800">{formatRupiah(targetPerJemaat)}</span>
                        </div>
                        <div className="flex justify-between text-base mb-4">
                            <span className="text-slate-600">Realisasi:</span>
                            <span className="font-bold text-indigo-600">{formatRupiah(grandTotal.totalKoa)}</span>
                        </div>
                        <div className={`p-3 rounded-md text-center text-sm font-bold uppercase tracking-wide ${selisihKoa >= 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                            {selisihKoa >= 0 ? 'Surplus / Lunas: ' : 'Kurang: '}
                            {formatRupiah(Math.abs(selisihKoa))}
                        </div>
                    </div>

                    <div className="p-5 border border-slate-200 rounded-lg bg-slate-50 shadow-sm">
                        <div className="font-bold text-slate-800 text-center border-b border-slate-200 pb-2 mb-4 text-lg">Syalom Haususu</div>
                        <div className="flex justify-between text-base mb-2">
                            <span className="text-slate-600">Beban (50%):</span>
                            <span className="font-bold text-slate-800">{formatRupiah(targetPerJemaat)}</span>
                        </div>
                        <div className="flex justify-between text-base mb-4">
                            <span className="text-slate-600">Realisasi:</span>
                            <span className="font-bold text-indigo-600">{formatRupiah(grandTotal.totalHaususu)}</span>
                        </div>
                        <div className={`p-3 rounded-md text-center text-sm font-bold uppercase tracking-wide ${selisihHaususu >= 0 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                            {selisihHaususu >= 0 ? 'Surplus / Lunas: ' : 'Kurang: '}
                            {formatRupiah(Math.abs(selisihHaususu))}
                        </div>
                    </div>
                </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export default KontribusiJemaat;