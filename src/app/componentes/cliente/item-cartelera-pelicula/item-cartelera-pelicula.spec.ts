import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ItemCarteleraPelicula } from './item-cartelera-pelicula';

describe('ItemCarteleraPelicula', () => {
  let component: ItemCarteleraPelicula;
  let fixture: ComponentFixture<ItemCarteleraPelicula>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemCarteleraPelicula],
    }).compileComponents();

    fixture = TestBed.createComponent(ItemCarteleraPelicula);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
