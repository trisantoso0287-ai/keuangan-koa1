import { useState, useEffect, Fragment } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

function LaporanSidang() {
  const [semuaTransaksi, setSemuaTransaksi] = useState([]);
  const [loading, setLoading] = useState(true);

  // State Filter Web
  const tahunSekarang = new Date().getFullYear().toString();
  const [filterTahun, setFilterTahun] = useState(tahunSekarang);
  const [startBulan, setStartBulan] = useState(1);
  const [endBulan, setEndBulan] = useState(new Date().getMonth() + 1);

  const namaBulanPendek = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGT', 'SEP', 'OKT', 'NOV', 'DES'];
  const namaBulanPanjang = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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

        const jemaatName = data.jemaat || data.namaJemaat || data.penyetor || 'Tanpa Keterangan Jemaat';

        daftarTransaksi.push({
          id: doc.id,
          ...data,
          jumlahAktual: jumlah,
          noMA: noMA,
          namaMA: namaMA || '-',
          apakahMasuk: apakahMasuk,
          jemaatName: jemaatName
        });
      });

      setSemuaTransaksi(daftarTransaksi);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const formatRupiah = (angka) => {
    if (angka === 0 || !angka) return '-';
    return new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0 }).format(angka);
  };

  // Format Angka Khusus Excel (Tanpa titik ribuan agar bisa dijumlahkan otomatis di Excel)
  const formatAngkaExcel = (angka) => {
    if (angka === 0 || !angka) return '-';
    return angka;
  };

  // ========================================================
  // PEMROSESAN DATA
  // ========================================================
  const transaksiTahunIni = semuaTransaksi.filter(t => t.tanggal && t.tanggal.startsWith(filterTahun));
  const rekapSidang = {};

  transaksiTahunIni.forEach(t => {
    const bulanIndex = parseInt(t.tanggal.split('-')[1], 10);
    const key = `${t.noMA}_${t.namaMA}`;
    const groupCode = t.noMA.charAt(0).toUpperCase(); 

    if (!rekapSidang[key]) {
      rekapSidang[key] = {
        groupCode: groupCode || 'Lainnya',
        noMA: t.noMA,
        namaMA: t.namaMA,
        apakahMasuk: t.apakahMasuk,
        bulanan: Array(12).fill(0),
        totalSetahun: 0,
        jemaatRincian: {}
      };
    }

    rekapSidang[key].bulanan[bulanIndex - 1] += t.jumlahAktual;
    rekapSidang[key].totalSetahun += t.jumlahAktual;

    if (t.apakahMasuk) {
      if (!rekapSidang[key].jemaatRincian[t.jemaatName]) {
        rekapSidang[key].jemaatRincian[t.jemaatName] = { bulanan: Array(12).fill(0), totalSetahun: 0 };
      }
      rekapSidang[key].jemaatRincian[t.jemaatName].bulanan[bulanIndex - 1] += t.jumlahAktual;
      rekapSidang[key].jemaatRincian[t.jemaatName].totalSetahun += t.jumlahAktual;
    }
  });

  const rawArray = Object.values(rekapSidang);
  const groupedData = {};

  rawArray.forEach(item => {
    if (!groupedData[item.groupCode]) {
      groupedData[item.groupCode] = { items: [], subtotalBulanan: Array(12).fill(0), subtotalTahun: 0 };
    }
    groupedData[item.groupCode].items.push(item);
    for(let i=0; i<12; i++) {
      groupedData[item.groupCode].subtotalBulanan[i] += item.bulanan[i];
    }
    groupedData[item.groupCode].subtotalTahun += item.totalSetahun;
  });

  const sortedGroupKeys = Object.keys(groupedData).sort();
  sortedGroupKeys.forEach(key => {
    groupedData[key].items.sort((a, b) => a.noMA.localeCompare(b.noMA));
  });

  // ========================================================
  // FUNGSI EXPORT KE EXCEL
  // ========================================================
  const handleDownloadExcel = () => {
    const tableHtml = document.getElementById('tabel-export-excel').outerHTML;
    const htmlTemplate = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <style>
            table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 11px; }
            th, td { border: 1px solid black; padding: 4px; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .bg-gray { background-color: #f3f4f6; }
            .italic { font-style: italic; }
          </style>
        </head>
        <body>
          ${tableHtml}
        </body>
      </html>
    `;

    const blob = new Blob([htmlTemplate], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Sidang_Koa1_${filterTahun}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="text-center p-8 text-slate-500">Memuat Data Laporan Sidang...</div>;

  // Hitung jumlah kolom dinamis untuk Excel (2 kolom tetap + jumlah bulan terpilih + 1 kolom jumlah)
  const jumlahKolomBulan = endBulan - startBulan + 1;
  const colSpanHeader = 2 + jumlahKolomBulan + 1; 

  return (
    <div className="animate-fade-in w-full">
      
      {/* TAMPILAN APLIKASI / WEB */}
      <div className="space-y-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Laporan Sidang Jemaat</h2>
              <p className="text-sm text-slate-500">Realisasi Anggaran Penerimaan dan Belanja</p>
            </div>
            <button onClick={handleDownloadExcel} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2 rounded-lg text-sm shadow transition-colors whitespace-nowrap flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
              </svg>
              Download Excel
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tahun Laporan</label>
              <input type="number" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dari Bulan</label>
              <select value={startBulan} onChange={(e) => setStartBulan(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-blue-500">
                {namaBulanPanjang.map((bulan, idx) => <option key={idx} value={idx + 1}>{bulan}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sampai Bulan</label>
              <select value={endBulan} onChange={(e) => setEndBulan(Number(e.target.value))} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-blue-500">
                {namaBulanPanjang.map((bulan, idx) => <option key={idx} value={idx + 1}>{bulan}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-800 text-white font-bold text-sm">
                  <th className="p-3 w-16 text-center border-r border-slate-700">NO MA</th>
                  <th className="p-3 w-64 border-r border-slate-700">MATA ANGGARAN</th>
                  {namaBulanPendek.map((bulan, idx) => {
                    if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <th key={idx} className="p-3 text-center border-r border-slate-700 w-28">{bulan}</th>;
                    return null;
                  })}
                  <th className="p-3 text-right bg-slate-900 w-32">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {sortedGroupKeys.length === 0 ? (
                  <tr><td colSpan="15" className="text-center p-8 text-slate-400">Tidak ada realisasi pada rentang waktu terpilih.</td></tr>
                ) : (
                  sortedGroupKeys.map(groupKey => (
                    <Fragment key={groupKey}>
                      {groupedData[groupKey].items.map((row, index) => {
                        let totalRentang = 0;
                        for (let i = startBulan - 1; i < endBulan; i++) totalRentang += row.bulanan[i];

                        return (
                          <Fragment key={`${groupKey}-${index}`}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-200">{row.noMA}</td>
                              <td className="p-3 font-bold text-slate-800 border-r border-slate-200">{row.namaMA}</td>
                              {row.bulanan.map((nilai, idx) => {
                                if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="p-3 text-right text-slate-800 font-semibold border-r border-slate-200">{formatRupiah(nilai)}</td>;
                                return null;
                              })}
                              <td className="p-3 text-right font-black text-slate-900 bg-slate-50 border-l border-slate-300">{formatRupiah(totalRentang)}</td>
                            </tr>
                            
                            {row.apakahMasuk && Object.keys(row.jemaatRincian).sort().map((jemKey) => {
                              const jemData = row.jemaatRincian[jemKey];
                              let totalRentangJem = 0;
                              for (let i = startBulan - 1; i < endBulan; i++) totalRentangJem += jemData.bulanan[i];
                              
                              if (totalRentangJem > 0) {
                                return (
                                  <tr key={`${row.noMA}-${jemKey}`} className="bg-slate-50/40 text-xs">
                                    <td className="p-2 border-r border-slate-200"></td>
                                    <td className="p-2 pl-6 text-slate-500 border-r border-slate-200">- {jemKey}</td>
                                    {jemData.bulanan.map((nilai, idx) => {
                                      if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="p-2 text-right text-slate-500 border-r border-slate-200">{formatRupiah(nilai)}</td>;
                                      return null;
                                    })}
                                    <td className="p-2 text-right font-semibold text-slate-600 bg-slate-50/60 border-l border-slate-300">{formatRupiah(totalRentangJem)}</td>
                                  </tr>
                                );
                              }
                              return null;
                            })}
                          </Fragment>
                        );
                      })}

                      {(() => {
                        let totalRentangGroup = 0;
                        for (let i = startBulan - 1; i < endBulan; i++) totalRentangGroup += groupedData[groupKey].subtotalBulanan[i];

                        return (
                          <tr className="bg-blue-900/10 font-bold text-blue-900 border-y-2 border-blue-900/20">
                            <td colSpan="2" className="p-3 text-right border-r border-slate-300 uppercase tracking-wide">JUMLAH KODE {groupKey}</td>
                            {groupedData[groupKey].subtotalBulanan.map((nilai, idx) => {
                              if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="p-3 text-right border-r border-slate-300">{formatRupiah(nilai)}</td>;
                              return null;
                            })}
                            <td className="p-3 text-right text-blue-950 bg-blue-900/20">{formatRupiah(totalRentangGroup)}</td>
                          </tr>
                        );
                      })()}
                    </Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ==========================================
          TABEL HIDDEN UNTUK EXPORT EXCEL
          ========================================== */}
      <table id="tabel-export-excel" style={{ display: 'none' }}>
        <thead>
          <tr>
            <th colSpan={colSpanHeader} className="text-center font-bold" style={{ fontSize: '14px', border: 'none' }}>
              REALISASI ANGGARAN PENERIMAAN DAN BELANJA
            </th>
          </tr>
          <tr>
            <th colSpan={colSpanHeader} className="text-center font-bold" style={{ fontSize: '14px', border: 'none' }}>
              JEMAAT KOA 1
            </th>
          </tr>
          <tr>
            <th colSpan={colSpanHeader} className="text-center font-bold" style={{ fontSize: '14px', border: 'none', paddingBottom: '15px' }}>
              TAHUN {filterTahun}
            </th>
          </tr>
          <tr>
            <th className="font-bold text-center" rowSpan="2" style={{ width: '60px' }}>NO<br/>MA</th>
            <th className="font-bold text-center" rowSpan="2" style={{ width: '250px' }}>MATA ANGGARAN</th>
            <th className="font-bold text-center" colSpan={jumlahKolomBulan}>BULAN</th>
            <th className="font-bold text-center" rowSpan="2" style={{ width: '100px' }}>JUMLAH</th>
          </tr>
          <tr>
            {namaBulanPendek.map((b, i) => {
              if (i + 1 >= startBulan && i + 1 <= endBulan) return <th key={i} className="font-bold text-center">{b}</th>;
              return null;
            })}
          </tr>
        </thead>
        <tbody>
          {sortedGroupKeys.length === 0 ? (
            <tr><td colSpan={colSpanHeader} className="text-center italic">Tidak ada data untuk tahun {filterTahun}</td></tr>
          ) : (
            sortedGroupKeys.map(groupKey => (
              <Fragment key={`xl-${groupKey}`}>
                {groupedData[groupKey].items.map((row, index) => {
                  let totalRentang = 0;
                  for (let i = startBulan - 1; i < endBulan; i++) totalRentang += row.bulanan[i];

                  return (
                    <Fragment key={`xl-${groupKey}-${index}`}>
                      <tr className="font-bold">
                        <td className="text-center">{row.noMA}</td>
                        <td>{row.namaMA}</td>
                        {row.bulanan.map((nilai, idx) => {
                          if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="text-right">{formatAngkaExcel(nilai)}</td>;
                          return null;
                        })}
                        <td className="text-right bg-gray">{formatAngkaExcel(totalRentang)}</td>
                      </tr>

                      {row.apakahMasuk && Object.keys(row.jemaatRincian).sort().map(jemKey => {
                        const jemData = row.jemaatRincian[jemKey];
                        let totalRentangJem = 0;
                        for (let i = startBulan - 1; i < endBulan; i++) totalRentangJem += jemData.bulanan[i];
                        
                        if (totalRentangJem > 0) {
                          return (
                            <tr key={`xl-${row.noMA}-${jemKey}`} className="italic">
                              <td></td>
                              <td>- {jemKey}</td>
                              {jemData.bulanan.map((nilai, idx) => {
                                if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="text-right">{formatAngkaExcel(nilai)}</td>;
                                return null;
                              })}
                              <td className="text-right bg-gray">{formatAngkaExcel(totalRentangJem)}</td>
                            </tr>
                          );
                        }
                        return null;
                      })}
                    </Fragment>
                  );
                })}

                {(() => {
                  let totalRentangGroup = 0;
                  for (let i = startBulan - 1; i < endBulan; i++) totalRentangGroup += groupedData[groupKey].subtotalBulanan[i];

                  return (
                    <tr className="font-bold bg-gray">
                      <td colSpan="2" className="text-right">JUMLAH KODE {groupKey}</td>
                      {groupedData[groupKey].subtotalBulanan.map((nilai, idx) => {
                        if (idx + 1 >= startBulan && idx + 1 <= endBulan) return <td key={idx} className="text-right">{formatAngkaExcel(nilai)}</td>;
                        return null;
                      })}
                      <td className="text-right font-bold">{formatAngkaExcel(totalRentangGroup)}</td>
                    </tr>
                  );
                })()}
              </Fragment>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default LaporanSidang;