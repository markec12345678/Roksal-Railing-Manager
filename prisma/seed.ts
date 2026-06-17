// Roksal Field - Seed Demo Data
import { db } from '@/lib/db'

async function seed() {
  console.log('Seeding Roksal Field database...')

  // Create demo profiles
  const marko = await db.profile.upsert({
    where: { email: 'marko@roksal.si' },
    update: {},
    create: {
      email: 'marko@roksal.si',
      ime: 'Marko Kranjc',
      vloga: 'MONTER',
      telefon: '+386 41 234 567',
      ekipaId: 'ekipa-A',
    }
  })

  const admin = await db.profile.upsert({
    where: { email: 'admin@roksal.si' },
    update: {},
    create: {
      email: 'admin@roksal.si',
      ime: 'Admin Roksal',
      vloga: 'ADMIN',
      telefon: '+386 41 111 222',
    }
  })

  const peter = await db.profile.upsert({
    where: { email: 'peter@roksal.si' },
    update: {},
    create: {
      email: 'peter@roksal.si',
      ime: 'Peter Horvat',
      vloga: 'VODJA',
      telefon: '+386 41 333 444',
      ekipaId: 'ekipa-A',
    }
  })

  // Create demo customers
  const customer1 = await db.customer.create({
    data: {
      ime: 'Janez Novak',
      naslov: 'Ljubljanska cesta 142, 4000 Kranj',
      telefon: '+386 41 555 666',
      email: 'janez.novak@email.si',
    }
  })

  const customer2 = await db.customer.create({
    data: {
      ime: 'Maja Zupan',
      naslov: 'Prešernova 22, 4220 Škofja Loka',
      telefon: '+386 41 777 888',
      email: 'maja.zupan@email.si',
    }
  })

  const customer3 = await db.customer.create({
    data: {
      ime: 'Andrej Kokalj',
      naslov: 'Cankarjeva 15, 4000 Kranj',
      telefon: '+386 41 999 000',
    }
  })

  // Create demo projects
  await db.project.create({
    data: {
      nazivProjekta: 'Ograja Novak - Balkon 3.nadstropje',
      status: 'V_TEKU',
      customerId: customer1.id,
      monterId: marko.id,
      vodjaId: peter.id,
      ekipaId: 'ekipa-A',
      datumMontaze: new Date(),
      opombe: 'Alu ograja - Model A (Anodizirana). Kemično sidranje v betonsko podlago.',
      latitude: 46.2397,
      longitude: 14.3556,
    }
  })

  await db.project.create({
    data: {
      nazivProjekta: 'Terasa Zupan - WPC deske',
      status: 'NACRTOVANO',
      customerId: customer2.id,
      monterId: marko.id,
      vodjaId: peter.id,
      datumMontaze: new Date(Date.now() + 3 * 86400000),
      opombe: 'WoodCore WPC deske, Anthracite. Montaža na jeklen okvir.',
    }
  })

  await db.project.create({
    data: {
      nazivProjekta: 'Ograja Kokalj - Balustrada',
      status: 'NACRTOVANO',
      customerId: customer3.id,
      monterId: marko.id,
      datumMontaze: new Date(Date.now() + 7 * 86400000),
      opombe: 'Stainless steel kabelska ograja. 12 točk sidranja.',
    }
  })

  // Create demo measurements
  const proj1 = await db.project.findFirst({ where: { nazivProjekta: { contains: 'Novak' } } })
  if (proj1) {
    await db.measurement.create({
      data: {
        projectId: proj1.id,
        dolzinaMm: 3200,
        visinaMm: 1050,
        gpsLokacija: JSON.stringify({ lat: 46.2397, lng: 14.3556 }),
      }
    })
    await db.measurement.create({
      data: {
        projectId: proj1.id,
        dolzinaMm: 1800,
        visinaMm: 1050,
      }
    })
  }

  // Create demo inventory
  const inventoryItems = [
    { sifra: 'WPC-120-A', naziv: 'WPC Deska 120mm Anthracite', tip: 'WPC_deska', zaloga: 450, enota: 'm', min: 100 },
    { sifra: 'WPC-120-B', naziv: 'WPC Deska 120mm Brown', tip: 'WPC_deska', zaloga: 120, enota: 'm', min: 50 },
    { sifra: 'INOX-M8-A2', naziv: 'Inox Vijak M8 A2', tip: 'Inox_vijak', zaloga: 800, enota: 'kos', min: 200 },
    { sifra: 'INOX-M12-A4', naziv: 'Inox Vijak M12 A4', tip: 'Inox_vijak', zaloga: 15, enota: 'kos', min: 50 },
    { sifra: 'SID-HILTI-330', naziv: 'Hilti HIT-RE 500 V3 (330ml)', tip: 'Kemicno_sidro', zaloga: 24, enota: 'kos', min: 10 },
    { sifra: 'ALU-PROF-40', naziv: 'Alu Profil 40x40', tip: 'Alu_profil', zaloga: 180, enota: 'm', min: 50 },
    { sifra: 'ALU-PROF-60', naziv: 'Alu Profil 60x40', tip: 'Alu_profil', zaloga: 85, enota: 'm', min: 30 },
    { sifra: 'EPDM-TESNILO', naziv: 'EPDM Tesnilo 10mm', tip: 'Alu_profil', zaloga: 300, enota: 'm', min: 100 },
  ]

  for (const item of inventoryItems) {
    await db.inventory.create({
      data: {
        sifraMateriala: item.sifra,
        naziv: item.naziv,
        tip: item.tip,
        kolicinaZaloga: item.zaloga,
        enota: item.enota,
        minimalnaZaloga: item.min,
      }
    })
  }

  // Create demo documents
  if (proj1) {
    await db.document.create({
      data: {
        projectId: proj1.id,
        tipDokumenta: 'TEHNICNI_LIST',
        status: 'GENERIRANO',
      }
    })
    await db.document.create({
      data: {
        projectId: proj1.id,
        tipDokumenta: 'PRIMOPREDAJA',
        status: 'GENERIRANO',
      }
    })
  }

  // ============================================
  // KATALOG PROFILOV OGRAJ (Roksal)
  // ============================================
  const profili = [
    { sifra: 'WPC-HLINE', naziv: 'ROKSAL WPC H-Line', material: 'WPC + ALU', kategorija: 'WPC vodoravno', visinaMm: 1100, sirinaMm: 140, cenaM: 145, barvaRal: '7016' },
    { sifra: 'WPC-VLINE', naziv: 'ROKSAL WPC V-Line', material: 'WPC + ALU', kategorija: 'WPC pokončno', visinaMm: 1100, sirinaMm: 140, cenaM: 155, barvaRal: '7016' },
    { sifra: 'WPC-PANEL', naziv: 'ROKSAL WPC Panelna', material: 'WPC Panel', kategorija: 'WPC panel', visinaMm: 1100, sirinaMm: 200, cenaM: 175, barvaRal: '7016' },
    { sifra: 'WPC-STEKLO', naziv: 'ROKSAL WPC + Steklo', material: 'WPC + Steklo', kategorija: 'Kombinirano', visinaMm: 1100, sirinaMm: 200, cenaM: 245, barvaRal: '7016' },
    { sifra: 'INOX-LINE', naziv: 'ROKSAL Inox Line', material: 'Inox', kategorija: 'Inox', visinaMm: 1100, sirinaMm: 120, cenaM: 195, barvaRal: 'EV1' },
    { sifra: 'INOX-TROSSE', naziv: 'ROKSAL Inox Trosse', material: 'Inox', kategorija: 'Inox vrvi', visinaMm: 1100, sirinaMm: 100, cenaM: 185, barvaRal: 'EV1' },
    { sifra: 'ALU-CLASSIC', naziv: 'ROKSAL ALU Klasik', material: 'Aluminij', kategorija: 'Alu klasično', visinaMm: 1100, sirinaMm: 100, cenaM: 115, barvaRal: '7016' },
    { sifra: 'ALU-MODERN', naziv: 'ROKSAL ALU Modern', material: 'Aluminij', kategorija: 'Alu moderno', visinaMm: 1100, sirinaMm: 120, cenaM: 135, barvaRal: '7016' },
    { sifra: 'STEKLO-FULL', naziv: 'ROKSAL Steklo Full', material: 'Steklo', kategorija: 'Steklo', visinaMm: 1100, sirinaMm: 200, cenaM: 285, barvaRal: '7016' },
    { sifra: 'STEKLO-MINI', naziv: 'ROKSAL Steklo Mini', material: 'Steklo', kategorija: 'Steklo', visinaMm: 800, sirinaMm: 200, cenaM: 225, barvaRal: '7016' },
  ]

  for (const p of profili) {
    await db.profil.upsert({
      where: { sifra: p.sifra },
      update: {},
      create: p,
    })
  }

  // ============================================
  // GALERIJA - vzorčna realizacija
  // ============================================
  const galerijaProfila = await db.profil.findUnique({ where: { sifra: 'WPC-HLINE' } })
  if (galerijaProfila && proj1) {
    await db.galleryItem.create({
      data: {
        projectId: proj1.id,
        profilId: galerijaProfila.id,
        naslov: 'Balkon Kokalj — WPC H-Line',
        opis: 'Menjava starih kovinskih ograj z WPC H-Line sistemom v antracit sivi.',
        lokacija: 'Kranj',
        javno: true,
      },
    }).catch(() => {})
  }

  console.log('Seed completed successfully!')
}

seed()
  .catch(console.error)
  .finally(() => process.exit(0))
