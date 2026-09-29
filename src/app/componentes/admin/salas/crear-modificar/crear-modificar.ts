import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  form,
  FormField,
  required,
  minLength,
  maxLength,
  validate,
  submit,
} from '@angular/forms/signals';
import { SalaService } from '../../../../services/sala-service';
import { SalaModelForm } from '../../../../modelos/sala-model';

@Component({
  imports: [FormField],
  selector: 'app-crear-modificar-sala',
  styleUrls: ['../../../compartido/stylesCompartidos/forms.css'],
  templateUrl: './crear-modificar.html',
})
export class CrearModificarSala implements OnInit {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private salaService = inject(SalaService);

  errorMsg = signal('');
  cargando = signal(false);

  salaId = signal<string | null>(null);
  esEdicion = computed(() => this.salaId() !== null);

  private model = signal<SalaModelForm>({
    numero: 0,
    nombre: '',
    activa: true,
  });

  salaForm = form(this.model, (s) => {
    required(s.numero, { message: 'El número de sala es obligatorio' });
    validate(s.numero, ({ value }) =>
      value() <= 0 || !Number.isInteger(value())
        ? { kind: 'min', message: 'Tiene que ser un entero mayor a 0' }
        : null,
    );

    required(s.nombre, { message: 'El nombre es obligatorio' });
    minLength(s.nombre, 2, { message: 'Mínimo 2 caracteres' });
    maxLength(s.nombre, 50, { message: 'Máximo 50 caracteres' });
  });

  async ngOnInit() {
    const id = this.route.snapshot.queryParamMap.get('id');
    if (!id) return;

    this.salaId.set(id);
    this.cargando.set(true);
    try {
      const sala = await this.salaService.getById(id);
      this.model.set({ numero: sala.numero, nombre: sala.nombre, activa: sala.activa });
    } catch (e: any) {
      this.errorMsg.set(e?.message ?? 'No se pudo cargar la sala');
    } finally {
      this.cargando.set(false);
    }
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    this.errorMsg.set('');

    await submit(this.salaForm, async () => {
      try {
        this.cargando.set(true);

        if (this.esEdicion()) {
          await this.salaService.modificar(this.salaId()!, this.model());
        } else {
          await this.salaService.crear(this.model());
        }

        this.router.navigate(['/admin/salas']);
      } catch (e: any) {
        // 23505 = unique: ya existe una sala con ese número
        this.errorMsg.set(
          e?.code === '23505' ? 'Ya existe una sala con ese número' : (e?.message ?? 'No se pudo guardar la sala'),
        );
      } finally {
        this.cargando.set(false);
      }
    });
  }
}
