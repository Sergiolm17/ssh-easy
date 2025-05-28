const open = require("./node_modules/open");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const Fuse = require("fuse.js");

const SSH_PROFILES_PATH = path.join(__dirname, "ssh_profiles.json");

// Configuración de Fuse.js
const fuseOptions = {
  keys: ["Title", "Subtitle", "keywords"],
  threshold: 0.4,
  includeScore: true,
};

// Comandos disponibles para autocompletado con palabras clave
const availableCommands = [
  {
    Title: "Direct SSH",
    Subtitle: "ssh d ", // Dejamos espacio para el usuario@host
    keywords: ["direct", "connect", "conectar"],
  },
  {
    Title: "List Profiles",
    Subtitle: "ssh profiles",
    keywords: ["list", "listar", "perfiles"],
  },
  {
    Title: "Add Profile",
    Subtitle: "ssh add ", // Dejamos espacio para MiPerfil usuario@host
    keywords: ["add", "agregar", "guardar", "perfil"],
  },
  {
    Title: "Remove Profile",
    Subtitle: "ssh remove",
    keywords: ["remove", "eliminar", "borrar", "perfil"],
  },
  {
    Title: "Direct SCP",
    Subtitle: "ssh scp d ", // Dejamos espacio para archivo.txt usuario@host:/destino
    keywords: ["scp", "transfer", "directo", "archivo"],
  },
  {
    Title: "Profile SCP",
    Subtitle: "ssh scp profiles ", // Dejamos espacio para archivo.txt /destino
    keywords: ["scp", "transfer", "perfil", "archivo"],
  },
];

// Función para cargar perfiles SSH
function loadSSHProfiles() {
  try {
    if (fs.existsSync(SSH_PROFILES_PATH)) {
      return JSON.parse(fs.readFileSync(SSH_PROFILES_PATH, "utf8"));
    }
    return {};
  } catch (error) {
    console.error("Error loading SSH profiles:", error);
    return {};
  }
}

// Función para guardar perfiles SSH
function saveSSHProfiles(profiles) {
  try {
    fs.writeFileSync(SSH_PROFILES_PATH, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error("Error saving SSH profiles:", error);
  }
}
if (!process.argv[2]) {
  console.log(JSON.stringify({ result: [] }));
  process.exit(0);
}

const { method, parameters } = JSON.parse(process.argv[2]);

if (method === "query") {
  const query = parameters[0] || "";
  const results = [];

  const args = query.trim();

  // --- Lógica principal de manejo de query ---

  // Caso 1: Entrada vacía - Mostrar guía rápida interactiva
  if (args === "") {
    results.push({
      Title: "Guía rápida SSH",
      Subtitle: "Comandos disponibles:",
      IcoPath: "Images\\app.png",
    });
    availableCommands.forEach((command) => {
      results.push({
        Title: command.Title,
        Subtitle: command.Subtitle,
        JsonRPCAction: {
          method: "Flow.Launcher.PutQueryInSearch",
          parameters: [
            command.Subtitle + (command.Subtitle.endsWith(" ") ? "" : " "),
          ],
        },
        IcoPath: "Images\\app.png",
      });
    });
  }
  // Caso 2: Entrada con texto - Intentar coincidencia exacta de comandos o usar Fuse.js
  else {
    // --- Coincidencia exacta de comandos (ejecutables directamente si tienen los parámetros) ---

    // Comando directo SSH
    if (args.startsWith("d ")) {
      const sshArgs = args.replace(/^d\s+/, "");
      results.push({
        Title: `SSH Connect: ${sshArgs}`,
        Subtitle: "Connect directly using SSH",
        JsonRPCAction: {
          method: "do_ssh_connect",
          parameters: [sshArgs],
        },
        IcoPath: "Images\\app.png",
      });
    }
    // Listar perfiles
    else if (args === "profiles") {
      const profiles = loadSSHProfiles();
      Object.keys(profiles).forEach((profile) => {
        results.push({
          Title: `Profile: ${profile}`,
          Subtitle: `Connect to ${profiles[profile]}`,
          JsonRPCAction: {
            method: "do_ssh_connect",
            parameters: [profiles[profile]],
          },
          IcoPath: "Images\\app.png",
        });
      });
    }
    // Agregar perfil
    else if (args.startsWith("add ")) {
      const addArgs = args.slice(4).trim().split(" ");
      if (addArgs.length >= 2) {
        const profileName = addArgs[0];
        const sshArgs = addArgs.slice(1).join(" ");
        results.push({
          Title: `Add Profile: ${profileName}`,
          Subtitle: `Save SSH connection: ${sshArgs}`,
          JsonRPCAction: {
            method: "do_add_profile",
            parameters: [profileName, sshArgs],
          },
          IcoPath: "Images\\app.png",
        });
      }
    }
    // Eliminar perfil - Listar perfiles para eliminar
    else if (args === "remove") {
      const profiles = loadSSHProfiles();
      Object.keys(profiles).forEach((profile) => {
        results.push({
          Title: `Remove Profile: ${profile}`,
          Subtitle: `Delete profile: ${profiles[profile]}`,
          JsonRPCAction: {
            method: "do_remove_profile",
            parameters: [profile],
          },
          IcoPath: "Images\\app.png",
        });
      });
    }
    // SCP directo
    else if (args.startsWith("scp d ")) {
      const scpArgs = args.slice(6).trim();
      results.push({
        Title: `SCP Transfer: ${scpArgs}`,
        Subtitle: "Transfer file using SCP",
        JsonRPCAction: {
          method: "do_scp_transfer",
          parameters: [scpArgs],
        },
        IcoPath: "Images\\app.png",
      });
    }
    // SCP con perfiles
    else if (args.startsWith("scp profiles ")) {
      const scpArgs = args.slice(13).trim();
      const profiles = loadSSHProfiles();

      // Si no hay argumentos después de "scp profiles ", listar perfiles como sugerencias interactivas
      if (scpArgs === "") {
        Object.keys(profiles).forEach((profile) => {
          results.push({
            Title: `SCP to Profile: ${profile}`,
            Subtitle: `Transfer file to ${profiles[profile]}`,
            JsonRPCAction: {
              method: "Flow.Launcher.PutQueryInSearch",
              parameters: [`ssh scp profiles ${profile} `], // Poner el comando en la barra con espacio al final
            },
            IcoPath: "Images\\app.png",
          });
        });
      } else {
        // Si hay argumentos, intentar buscar perfiles o sugerir transferencia SCP
        const [profileNameInput, ...fileAndDestinationParts] =
          scpArgs.split(" ");
        const fileAndDestination = fileAndDestinationParts.join(" ");

        const profileMatch = Object.keys(profiles).find(
          (profileName) =>
            profileName.toLowerCase() === profileNameInput.toLowerCase()
        );

        if (profileMatch) {
          // Si coincide con un perfil, ofrecer la opción de transferencia con ese perfil (ejecutable)
          results.push({
            Title: `SCP to Profile: ${profileMatch}`,
            Subtitle: `Transfer file to ${profiles[profileMatch]}${
              fileAndDestination ? ":" + fileAndDestination : ""
            }`, // Construir subtítulo con destino si existe
            JsonRPCAction: {
              method: "do_scp_profile_transfer",
              parameters: [profileMatch, fileAndDestination],
            },
            IcoPath: "Images\\app.png",
          });
        } else {
          // Si no coincide con un perfil, usar Fuse.js para sugerir perfiles para SCP (interactivas)
          const fuse = new Fuse(
            Object.keys(profiles).map((key) => ({
              name: key,
              ssh: profiles[key],
            })),
            { keys: ["name", "ssh"], threshold: 0.4 }
          );
          const profileMatchesFuse = fuse.search(profileNameInput);

          profileMatchesFuse.forEach((match) => {
            const profileName = match.item.name;
            results.push({
              Title: `SCP to Profile: ${profileName}`,
              Subtitle: `Transfer file using SCP to profile ${profileName}`,
              JsonRPCAction: {
                method: "Flow.Launcher.PutQueryInSearch",
                parameters: [
                  `ssh scp profiles ${profileName} ${fileAndDestination}`,
                ], // Poner el comando en la barra con argumentos existentes
              },
              IcoPath: "Images\\app.png",
            });
          });
          // Si no hay perfiles que coincidan, mostrar una sugerencia genérica de SCP con perfiles (no ejecutable)
          if (profileMatchesFuse.length === 0 && profileNameInput !== "") {
            results.push({
              Title: `SCP to Profile: ${profileNameInput} (perfil no encontrado)`,
              Subtitle: `Transfer file using SCP to a profile`,
              JsonRPCAction: {
                method: "",
                parameters: [],
              },
              IcoPath: "Images\\app.png",
            });
          }
        }
      }
    }
    // --- Fin Coincidencia exacta de comandos ---

    // --- Sugerencias de autocompletado con Fuse.js si no hay coincidencia exacta ---
    if (results.length === 0) {
      const fuse = new Fuse(availableCommands, fuseOptions);
      const searchResults = fuse.search(args);

      // Procesar resultados de búsqueda de Fuse.js
      searchResults.forEach((result) => {
        // Si el resultado es "List Profiles", generar la acción directa de listar perfiles
        if (result.item.Title === "List Profiles") {
          const profiles = loadSSHProfiles();
          Object.keys(profiles).forEach((profile) => {
            results.push({
              Title: `Profile: ${profile}`,
              Subtitle: `Connect to ${profiles[profile]}`,
              JsonRPCAction: {
                method: "do_ssh_connect",
                parameters: [profiles[profile]],
              },
              IcoPath: "Images\\app.png",
            });
          });
        }
        // Si el resultado es "Remove Profile", generar la acción directa de listar perfiles para eliminar
        else if (result.item.Title === "Remove Profile") {
          const profiles = loadSSHProfiles();
          // Aquí generamos la lista de perfiles *directamente*, igual que al escribir "ssh remove"
          Object.keys(profiles).forEach((profile) => {
            results.push({
              Title: `Remove Profile: ${profile}`,
              Subtitle: `Delete profile: ${profiles[profile]}`,
              JsonRPCAction: {
                method: "do_remove_profile",
                parameters: [profile],
              },
              IcoPath: "Images\\app.png",
            });
          });
        }
        // Para otros resultados, generar la acción de poner el comando en la barra
        else {
          results.push({
            Title: result.item.Title,
            Subtitle: result.item.Subtitle,
            JsonRPCAction: {
              method: "Flow.Launcher.PutQueryInSearch",
              parameters: [
                result.item.Subtitle +
                  (result.item.Subtitle.endsWith(" ") ? "" : " "),
              ],
            },
            IcoPath: "Images\\app.png",
          });
        }
      });

      // Si la entrada coincide con un perfil existente, agregarlo como opción ejecutable
      const profiles = loadSSHProfiles();
      const profileMatch = Object.keys(profiles).find(
        (profileName) => profileName.toLowerCase() === args.toLowerCase()
      );
      if (profileMatch) {
        results.push({
          Title: `Profile: ${profileMatch}`,
          Subtitle: `Connect to ${profiles[profileMatch]}`,
          JsonRPCAction: {
            method: "do_ssh_connect",
            parameters: [profiles[profileMatch]],
          },
          IcoPath: "Images\\app.png",
        });
      }
    }
    // --- Fin Sugerencias de autocompletado ---
  }
  // --- Fin Lógica principal de manejo de query ---

  console.log(JSON.stringify({ result: results }));
  return;
}

if (method === "do_ssh_connect") {
  const sshArgs = parameters[0];
  // Abrir nueva ventana de PowerShell con SSH
  const command = `start powershell -NoExit -Command \"ssh ${sshArgs}\"`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
}

if (method === "do_add_profile") {
  const [profileName, sshArgs] = parameters;
  const profiles = loadSSHProfiles();
  profiles[profileName] = sshArgs;
  saveSSHProfiles(profiles);
}

if (method === "do_remove_profile") {
  const profileName = parameters[0];
  const profiles = loadSSHProfiles();
  delete profiles[profileName];
  saveSSHProfiles(profiles);
}

if (method === "do_scp_transfer") {
  const scpArgs = parameters[0];
  exec(`scp ${scpArgs}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error}`);
      return;
    }
    console.log(stdout);
  });
}

if (method === "do_scp_profile_transfer") {
  const [profile, scpArgs] = parameters;
  const profiles = loadSSHProfiles();
  const sshArgs = profiles[profile];
  if (sshArgs) {
    const [file, destination] = scpArgs.split(" ");
    exec(`scp ${file} ${sshArgs}:${destination}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
        return;
      }
      console.log(stdout);
    });
  }
}
