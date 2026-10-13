/**
 * Pestaña 05 · Usuarios. Solo para el administrador.
 *
 * Da de alta cuentas (nombre, correo y contraseña), les cambia la contraseña,
 * las activa o desactiva y las borra. El NOMBRE es el punto de todo esto: es
 * lo que después aparece en la columna "Guardado por" de los proyectos, para
 * saber quién hizo cada despiece.
 *
 * Nada de esto se hace desde el navegador: crear una cuenta o cambiarle la
 * clave necesita la llave secreta de Supabase, así que todo pasa por la Edge
 * Function `usuarios`, que además vuelve a comprobar que quien llama sea
 * admin. Esta pantalla solo se esconde; la que decide es la función.
 */
;(function () {
  function arrancar() {
    const N = window.CIP_NUBE
    if (!N) return
    const yo = N.yo()
    if (!yo || yo.rol !== 'admin') return
    if (document.querySelector('[data-tab="usuarios"]')) return

    const barra = document.querySelector('.tabs')
    const main = document.querySelector('main.main')
    if (!barra || !main) return

    const boton = N.el('<button class="tab" data-tab="usuarios"><span class="tab-num">05</span>Usuarios</button>')
    barra.appendChild(boton)

    const panel = N.el(`<div class="tab-content" id="tab-usuarios">
      <div class="cip-proy-fila">
        <input id="u-nombre" placeholder="Nombre y apellido" maxlength="80">
        <input id="u-email" type="email" placeholder="correo" maxlength="120">
        <input id="u-pass" type="password" placeholder="contraseña" maxlength="60">
        <select id="u-rol">
          <option value="usuario">Usuario</option>
          <option value="admin">Administrador</option>
        </select>
        <button class="cip-btn" id="u-crear">Agregar</button>
      </div>
      <div id="u-lista">Consultando…</div>
      <div id="u-msg"></div>
    </div>`)
    main.appendChild(panel)

    boton.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'))
      document.querySelectorAll('.tab-content').forEach((x) => x.classList.remove('active'))
      boton.classList.add('active')
      panel.classList.add('active')
      pintar()
    })
    document.querySelectorAll('.tab:not([data-tab="usuarios"])').forEach((t) => {
      t.addEventListener('click', () => {
        boton.classList.remove('active')
        panel.classList.remove('active')
      })
    })

    const msg = (t, ok) => {
      const c = document.getElementById('u-msg')
      if (c) c.innerHTML = `<div class="cip-aviso ${ok ? 'ok' : ''}">${t}</div>`
    }

    panel.querySelector('#u-crear').onclick = async () => {
      const nombre = panel.querySelector('#u-nombre').value.trim()
      const email = panel.querySelector('#u-email').value.trim()
      const password = panel.querySelector('#u-pass').value
      const rol = panel.querySelector('#u-rol').value
      if (!nombre || !email) return msg('Hacen falta el nombre y el correo.')
      if (password.length < 6) return msg('La contraseña tiene que tener al menos 6 caracteres.')
      const r = await N.llamarFuncion({ accion: 'crear', nombre, email, password, rol })
      if (!r.ok) return msg(N.limpio(r.mensaje))
      panel.querySelector('#u-nombre').value = ''
      panel.querySelector('#u-email').value = ''
      panel.querySelector('#u-pass').value = ''
      msg(`Cuenta creada para <b>${N.limpio(nombre)}</b>.`, true)
      pintar()
    }

    async function pintar() {
      const caja = document.getElementById('u-lista')
      if (!caja) return
      const r = await N.llamarFuncion({ accion: 'listar' })
      if (!r.ok) {
        caja.innerHTML = ''
        return msg(N.limpio(r.mensaje))
      }
      const filas = r.usuarios || []
      caja.innerHTML =
        '<table><thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>' +
        '<th>Alta</th><th></th></tr></thead><tbody>' +
        filas
          .map(
            (u) => `<tr>
              <td><b>${N.limpio(u.nombre) || '—'}</b></td>
              <td>${N.limpio(u.email)}</td>
              <td>${u.rol === 'admin' ? 'Administrador' : 'Usuario'}</td>
              <td>${u.activo ? 'Activo' : 'Inactivo'}</td>
              <td>${N.fecha(u.creado_el)}</td>
              <td style="text-align:right;white-space:nowrap">
                <button class="cip-btn gris" data-nombre="${u.id}" data-actual="${N.limpio(u.nombre)}">Nombre</button>
                <button class="cip-btn" data-clave="${u.id}" data-nom="${N.limpio(u.nombre)}">Contraseña</button>
                <button class="cip-btn gris" data-rol="${u.id}" data-nuevo="${u.rol === 'admin' ? 'usuario' : 'admin'}">
                  ${u.rol === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                </button>
                <button class="cip-btn gris" data-activo="${u.id}" data-val="${u.activo ? 'false' : 'true'}">
                  ${u.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button class="cip-btn rojo" data-borrar="${u.id}">Borrar</button>
              </td></tr>`,
          )
          .join('') +
        '</tbody></table>'

      caja.querySelectorAll('[data-nombre]').forEach((b) => {
        b.onclick = async () => {
          const nuevo = prompt('Nombre de la persona:', b.dataset.actual || '')
          if (nuevo === null) return
          if (!nuevo.trim()) return msg('El nombre no puede quedar vacío.')
          const r2 = await N.llamarFuncion({ accion: 'actualizar', id: b.dataset.nombre, nombre: nuevo })
          if (!r2.ok) return msg(N.limpio(r2.mensaje))
          if (b.dataset.nombre === yo.id) await N.refrescarme()
          pintar()
        }
      })
      caja.querySelectorAll('[data-clave]').forEach((b) => {
        b.onclick = async () => {
          const nueva = prompt(`Contraseña nueva para ${b.dataset.nom}:`)
          if (nueva === null) return
          if (nueva.length < 6) return msg('La contraseña tiene que tener al menos 6 caracteres.')
          const r2 = await N.llamarFuncion({ accion: 'cambiar_clave', id: b.dataset.clave, password: nueva })
          msg(r2.ok ? 'Contraseña cambiada.' : N.limpio(r2.mensaje), r2.ok)
        }
      })
      caja.querySelectorAll('[data-rol]').forEach((b) => {
        b.onclick = async () => {
          const r2 = await N.llamarFuncion({ accion: 'actualizar', id: b.dataset.rol, rol: b.dataset.nuevo })
          if (!r2.ok) return msg(N.limpio(r2.mensaje))
          pintar()
        }
      })
      caja.querySelectorAll('[data-activo]').forEach((b) => {
        b.onclick = async () => {
          const r2 = await N.llamarFuncion({
            accion: 'actualizar',
            id: b.dataset.activo,
            activo: b.dataset.val === 'true',
          })
          if (!r2.ok) return msg(N.limpio(r2.mensaje))
          pintar()
        }
      })
      caja.querySelectorAll('[data-borrar]').forEach((b) => {
        b.onclick = async () => {
          if (!confirm('¿Borrar esa cuenta? No se puede deshacer.')) return
          const r2 = await N.llamarFuncion({ accion: 'borrar', id: b.dataset.borrar })
          if (!r2.ok) return msg(N.limpio(r2.mensaje))
          pintar()
        }
      })
    }
  }

  // la pestaña se arma cuando la nube ya sabe quién entró y con qué rol
  window.addEventListener('cip-entro', arrancar)

  // y se va con la sesión: si después entra alguien que no es admin, no tiene
  // por qué encontrarse la pantalla de cuentas de la persona anterior
  window.addEventListener('cip-sali', () => {
    document.querySelector('[data-tab="usuarios"]')?.remove()
    document.getElementById('tab-usuarios')?.remove()
  })
})()
