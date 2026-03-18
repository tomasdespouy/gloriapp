// Seed 100 Latin American universities with psychology programs into CRM
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const universities = [
  { name: "Universidad Nacional Autónoma de México", country: "México", city: "Ciudad de México", website: "https://www.unam.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 25000 },
  { name: "Universidad de Guadalajara", country: "México", city: "Guadalajara", website: "https://www.udg.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Benemérita Universidad Autónoma de Puebla", country: "México", city: "Puebla", website: "https://www.buap.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 4000 },
  { name: "Universidad Autónoma de Nuevo León", country: "México", city: "Monterrey", website: "https://www.uanl.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 4500 },
  { name: "Universidad de las Américas Puebla", country: "México", city: "Cholula", website: "https://www.udlap.mx", type: "privada", program_name: "Licenciatura en Psicología Clínica", estimated_students: 800 },
  { name: "Instituto Tecnológico y de Estudios Superiores de Occidente", country: "México", city: "Tlaquepaque", website: "https://www.iteso.mx", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 600 },
  { name: "Universidad Iberoamericana", country: "México", city: "Ciudad de México", website: "https://ibero.mx", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1200 },
  { name: "Universidad Anáhuac México", country: "México", city: "Huixquilucan", website: "https://www.anahuac.mx", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1000 },
  { name: "Universidad Autónoma Metropolitana", country: "México", city: "Ciudad de México", website: "https://www.uam.mx", type: "pública", program_name: "Licenciatura en Psicología Social", estimated_students: 3000 },
  { name: "Universidad Autónoma del Estado de Morelos", country: "México", city: "Cuernavaca", website: "https://www.uaem.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2000 },
  { name: "Universidad Nacional de Colombia", country: "Colombia", city: "Bogotá", website: "https://unal.edu.co", type: "pública", program_name: "Psicología", estimated_students: 1500 },
  { name: "Universidad de los Andes", country: "Colombia", city: "Bogotá", website: "https://uniandes.edu.co", type: "privada", program_name: "Psicología", estimated_students: 800 },
  { name: "Pontificia Universidad Javeriana", country: "Colombia", city: "Bogotá", website: "https://www.javeriana.edu.co", type: "privada", program_name: "Psicología", estimated_students: 1200 },
  { name: "Universidad del Rosario", country: "Colombia", city: "Bogotá", website: "https://www.urosario.edu.co", type: "privada", program_name: "Psicología", estimated_students: 900 },
  { name: "Universidad del Norte", country: "Colombia", city: "Barranquilla", website: "https://www.uninorte.edu.co", type: "privada", program_name: "Psicología", estimated_students: 700 },
  { name: "Universidad del Valle", country: "Colombia", city: "Cali", website: "https://www.univalle.edu.co", type: "pública", program_name: "Psicología", estimated_students: 1000 },
  { name: "Universidad ICESI", country: "Colombia", city: "Cali", website: "https://www.icesi.edu.co", type: "privada", program_name: "Psicología", estimated_students: 500 },
  { name: "Universidad de Antioquia", country: "Colombia", city: "Medellín", website: "https://www.udea.edu.co", type: "pública", program_name: "Psicología", estimated_students: 1200 },
  { name: "Universidad de La Sabana", country: "Colombia", city: "Chía", website: "https://www.unisabana.edu.co", type: "privada", program_name: "Psicología", estimated_students: 600 },
  { name: "Universidad de Buenos Aires", country: "Argentina", city: "Buenos Aires", website: "https://www.uba.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 40000 },
  { name: "Universidad Nacional de La Plata", country: "Argentina", city: "La Plata", website: "https://www.unlp.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 8000 },
  { name: "Universidad Nacional de Córdoba", country: "Argentina", city: "Córdoba", website: "https://www.unc.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 7000 },
  { name: "Universidad Católica Argentina", country: "Argentina", city: "Buenos Aires", website: "https://www.uca.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 2000 },
  { name: "Universidad de Belgrano", country: "Argentina", city: "Buenos Aires", website: "https://www.ub.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1500 },
  { name: "Universidad Nacional de Rosario", country: "Argentina", city: "Rosario", website: "https://www.unr.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad del Salvador", country: "Argentina", city: "Buenos Aires", website: "https://www.usal.edu.ar", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1800 },
  { name: "Universidad de Chile", country: "Chile", city: "Santiago", website: "https://www.uchile.cl", type: "pública", program_name: "Psicología", estimated_students: 1500 },
  { name: "Pontificia Universidad Católica de Chile", country: "Chile", city: "Santiago", website: "https://www.uc.cl", type: "privada", program_name: "Psicología", estimated_students: 1200 },
  { name: "Universidad de Santiago de Chile", country: "Chile", city: "Santiago", website: "https://www.usach.cl", type: "pública", program_name: "Psicología", estimated_students: 800 },
  { name: "Universidad Diego Portales", country: "Chile", city: "Santiago", website: "https://www.udp.cl", type: "privada", program_name: "Psicología", estimated_students: 900 },
  { name: "Universidad Andrés Bello", country: "Chile", city: "Santiago", website: "https://www.unab.cl", type: "privada", program_name: "Psicología", estimated_students: 2500 },
  { name: "Universidad de Concepción", country: "Chile", city: "Concepción", website: "https://www.udec.cl", type: "pública", program_name: "Psicología", estimated_students: 800 },
  { name: "Universidad Mayor", country: "Chile", city: "Santiago", website: "https://www.umayor.cl", type: "privada", program_name: "Psicología", estimated_students: 1500 },
  { name: "Universidad de Talca", country: "Chile", city: "Talca", website: "https://www.utalca.cl", type: "pública", program_name: "Psicología", estimated_students: 500 },
  { name: "Pontificia Universidad Católica del Perú", country: "Perú", city: "Lima", website: "https://www.pucp.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 1200 },
  { name: "Universidad Peruana Cayetano Heredia", country: "Perú", city: "Lima", website: "https://cayetano.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 600 },
  { name: "Universidad Nacional Mayor de San Marcos", country: "Perú", city: "Lima", website: "https://www.unmsm.edu.pe", type: "pública", program_name: "Psicología", estimated_students: 2000 },
  { name: "Universidad de Lima", country: "Perú", city: "Lima", website: "https://www.ulima.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 800 },
  { name: "Universidad Peruana de Ciencias Aplicadas", country: "Perú", city: "Lima", website: "https://www.upc.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 1500 },
  { name: "Universidad Nacional Federico Villarreal", country: "Perú", city: "Lima", website: "https://www.unfv.edu.pe", type: "pública", program_name: "Psicología", estimated_students: 1800 },
  { name: "Universidade de São Paulo", country: "Brasil", city: "São Paulo", website: "https://www5.usp.br", type: "pública", program_name: "Psicologia", estimated_students: 2000 },
  { name: "Pontifícia Universidade Católica de São Paulo", country: "Brasil", city: "São Paulo", website: "https://www.pucsp.br", type: "privada", program_name: "Psicologia", estimated_students: 1500 },
  { name: "Universidade Federal do Rio de Janeiro", country: "Brasil", city: "Río de Janeiro", website: "https://ufrj.br", type: "pública", program_name: "Psicologia", estimated_students: 1200 },
  { name: "Universidade Federal de Minas Gerais", country: "Brasil", city: "Belo Horizonte", website: "https://www.ufmg.br", type: "pública", program_name: "Psicologia", estimated_students: 1000 },
  { name: "Universidade de Brasília", country: "Brasil", city: "Brasilia", website: "https://www.unb.br", type: "pública", program_name: "Psicologia", estimated_students: 800 },
  { name: "Universidade Estadual Paulista", country: "Brasil", city: "Bauru", website: "https://www.unesp.br", type: "pública", program_name: "Psicologia", estimated_students: 600 },
  { name: "Universidade Federal do Rio Grande do Sul", country: "Brasil", city: "Porto Alegre", website: "https://www.ufrgs.br", type: "pública", program_name: "Psicologia", estimated_students: 900 },
  { name: "Universidade Estadual de Maringá", country: "Brasil", city: "Maringá", website: "https://www.uem.br", type: "pública", program_name: "Psicologia", estimated_students: 400 },
  { name: "Pontifícia Universidade Católica do Rio de Janeiro", country: "Brasil", city: "Río de Janeiro", website: "https://www.puc-rio.br", type: "privada", program_name: "Psicologia", estimated_students: 700 },
  { name: "Universidade Federal da Bahia", country: "Brasil", city: "Salvador", website: "https://www.ufba.br", type: "pública", program_name: "Psicologia", estimated_students: 600 },
  { name: "Universidad Central del Ecuador", country: "Ecuador", city: "Quito", website: "https://www.uce.edu.ec", type: "pública", program_name: "Psicología Clínica", estimated_students: 2000 },
  { name: "Pontificia Universidad Católica del Ecuador", country: "Ecuador", city: "Quito", website: "https://www.puce.edu.ec", type: "privada", program_name: "Psicología Clínica", estimated_students: 800 },
  { name: "Universidad San Francisco de Quito", country: "Ecuador", city: "Quito", website: "https://www.usfq.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 500 },
  { name: "Universidad de Guayaquil", country: "Ecuador", city: "Guayaquil", website: "https://www.ug.edu.ec", type: "pública", program_name: "Psicología", estimated_students: 3000 },
  { name: "Universidad Técnica Particular de Loja", country: "Ecuador", city: "Loja", website: "https://www.utpl.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 1500 },
  { name: "Universidad Politécnica Salesiana", country: "Ecuador", city: "Cuenca", website: "https://www.ups.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 1000 },
  { name: "Universidad Autónoma de Santo Domingo", country: "República Dominicana", city: "Santo Domingo", website: "https://uasd.edu.do", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Instituto Tecnológico de Santo Domingo", country: "República Dominicana", city: "Santo Domingo", website: "https://www.intec.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 600 },
  { name: "Universidad Iberoamericana (UNIBE)", country: "República Dominicana", city: "Santo Domingo", website: "https://www.unibe.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 800 },
  { name: "Universidad Nacional Pedro Henríquez Ureña", country: "República Dominicana", city: "Santo Domingo", website: "https://www.unphu.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 700 },
  { name: "Pontificia Universidad Católica Madre y Maestra", country: "República Dominicana", city: "Santiago de los Caballeros", website: "https://pucmm.edu.do", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 900 },
  { name: "Universidad Central de Venezuela", country: "Venezuela", city: "Caracas", website: "http://www.ucv.ve", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2000 },
  { name: "Universidad Católica Andrés Bello", country: "Venezuela", city: "Caracas", website: "https://www.ucab.edu.ve", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1200 },
  { name: "Universidad Rafael Urdaneta", country: "Venezuela", city: "Maracaibo", website: "https://www.uru.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 500 },
  { name: "Universidad Bicentenaria de Aragua", country: "Venezuela", city: "Maracay", website: "https://www.uba.edu.ve", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 800 },
  { name: "Universidad de Costa Rica", country: "Costa Rica", city: "San José", website: "https://www.ucr.ac.cr", type: "pública", program_name: "Bachillerato y Licenciatura en Psicología", estimated_students: 1500 },
  { name: "Universidad Latina de Costa Rica", country: "Costa Rica", city: "San José", website: "https://www.ulatina.ac.cr", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 600 },
  { name: "Universidad Autónoma de Centro América", country: "Costa Rica", city: "San José", website: "https://www.uaca.ac.cr", type: "privada", program_name: "Bachillerato en Psicología", estimated_students: 400 },
  { name: "Universidad de la República", country: "Uruguay", city: "Montevideo", website: "https://www.udelar.edu.uy", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 8000 },
  { name: "Universidad Católica del Uruguay", country: "Uruguay", city: "Montevideo", website: "https://www.ucu.edu.uy", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 800 },
  { name: "Universidad de Montevideo", country: "Uruguay", city: "Montevideo", website: "https://www.um.edu.uy", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 400 },
  { name: "Universidad Nacional de Asunción", country: "Paraguay", city: "Asunción", website: "https://www.una.py", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2000 },
  { name: "Universidad Católica Nuestra Señora de la Asunción", country: "Paraguay", city: "Asunción", website: "https://www.universidadcatolica.edu.py", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1200 },
  { name: "Universidad del Pacífico", country: "Paraguay", city: "Asunción", website: "https://www.upacifico.edu.py", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 500 },
  { name: "Universidad Mayor de San Andrés", country: "Bolivia", city: "La Paz", website: "https://www.umsa.bo", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2500 },
  { name: "Universidad Católica Boliviana San Pablo", country: "Bolivia", city: "La Paz", website: "https://www.ucb.edu.bo", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 800 },
  { name: "Universidad Mayor de San Simón", country: "Bolivia", city: "Cochabamba", website: "https://www.umss.edu.bo", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 1500 },
  { name: "Universidad de Panamá", country: "Panamá", city: "Ciudad de Panamá", website: "https://www.up.ac.pa", type: "pública", program_name: "Licenciatura en Psicología", contact_email: "admision.facpsicologia@up.ac.pa", estimated_students: 2000 },
  { name: "Universidad del Istmo", country: "Panamá", city: "Ciudad de Panamá", website: "https://www.udelistmo.edu", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 500 },
  { name: "Universidad Latina de Panamá", country: "Panamá", city: "Ciudad de Panamá", website: "https://www.ulatina.edu.pa", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 700 },
  { name: "Universidad de San Carlos de Guatemala", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://portal.usac.edu.gt", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 5000 },
  { name: "Universidad Rafael Landívar", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://principal.url.edu.gt", type: "privada", program_name: "Licenciatura en Psicología Clínica", estimated_students: 1200 },
  { name: "Universidad Mariano Gálvez de Guatemala", country: "Guatemala", city: "Ciudad de Guatemala", website: "https://www.umg.edu.gt", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 6000 },
  { name: "Universidad Nacional Autónoma de Honduras", country: "Honduras", city: "Tegucigalpa", website: "https://www.unah.edu.hn", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2500 },
  { name: "Universidad Tecnológica de Honduras", country: "Honduras", city: "San Pedro Sula", website: "https://www.uth.hn", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 800 },
  { name: "Universidad de El Salvador", country: "El Salvador", city: "San Salvador", website: "https://www.ues.edu.sv", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2000 },
  { name: "Universidad Tecnológica de El Salvador", country: "El Salvador", city: "San Salvador", website: "https://www.utec.edu.sv", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 1000 },
  { name: "Universidad Dr. José Matías Delgado", country: "El Salvador", city: "Antiguo Cuscatlán", website: "https://www.ujmd.edu.sv", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 600 },
  { name: "Universidad Nacional Autónoma de Nicaragua", country: "Nicaragua", city: "Managua", website: "https://www.unan.edu.ni", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 1500 },
  { name: "Universidad Centroamericana", country: "Nicaragua", city: "Managua", website: "https://www.uca.edu.ni", type: "privada", program_name: "Licenciatura en Psicología", estimated_students: 400 },
  { name: "Universidad de La Habana", country: "Cuba", city: "La Habana", website: "https://www.uh.cu", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 1500 },
  { name: "Universidad de Oriente", country: "Cuba", city: "Santiago de Cuba", website: "https://www.uo.edu.cu", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 600 },
  { name: "Universidad Central Marta Abreu de Las Villas", country: "Cuba", city: "Santa Clara", website: "https://www.uclv.edu.cu", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 500 },
  { name: "Universidad Tecnológica del Perú", country: "Perú", city: "Lima", website: "https://www.utp.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 3000 },
  { name: "Universidad César Vallejo", country: "Perú", city: "Trujillo", website: "https://www.ucv.edu.pe", type: "privada", program_name: "Psicología", estimated_students: 5000 },
  { name: "Universidad de las Américas", country: "Ecuador", city: "Quito", website: "https://www.udla.edu.ec", type: "privada", program_name: "Psicología Clínica", estimated_students: 700 },
  { name: "Universidad Internacional del Ecuador", country: "Ecuador", city: "Quito", website: "https://www.uide.edu.ec", type: "privada", program_name: "Psicología", estimated_students: 500 },
  { name: "Universidad Autónoma de Chiriquí", country: "Panamá", city: "David", website: "https://www.unachi.ac.pa", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 600 },
  { name: "Universidad del Desarrollo", country: "Chile", city: "Santiago", website: "https://www.udd.cl", type: "privada", program_name: "Psicología", estimated_students: 800 },
  { name: "Universidad Autónoma del Estado de México", country: "México", city: "Toluca", website: "https://www.uaemex.mx", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 3000 },
  { name: "Universidad Nacional de Mar del Plata", country: "Argentina", city: "Mar del Plata", website: "https://www.mdp.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 3000 },
  { name: "Universidad Nacional de Tucumán", country: "Argentina", city: "San Miguel de Tucumán", website: "https://www.unt.edu.ar", type: "pública", program_name: "Licenciatura en Psicología", estimated_students: 2500 },
  { name: "Universidad Simón Bolívar", country: "Colombia", city: "Barranquilla", website: "https://www.unisimon.edu.co", type: "privada", program_name: "Psicología", estimated_students: 1500 },
];

async function seed() {
  console.log(`Seeding ${universities.length} universities into CRM...`);

  // Check if already seeded
  const { count } = await supabase.from("crm_universities").select("*", { count: "exact", head: true });
  if (count && count > 0) {
    console.log(`CRM already has ${count} universities. Skipping seed.`);
    return;
  }

  const { data, error } = await supabase
    .from("crm_universities")
    .insert(universities.map((u) => ({
      ...u,
      status: "prospecto",
      priority: "media",
    })))
    .select("id");

  if (error) {
    console.error("Error seeding:", error.message);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data.length} universities.`);
}

seed();
