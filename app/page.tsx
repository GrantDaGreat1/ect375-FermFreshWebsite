'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
};

type CartState = Record<string, number>;

const FALLBACK_MENU: MenuItem[] = [
  {
    id: 'classic-original',
    name: 'Classic Original Kombucha',
    description: 'Crisp, tart, and lightly effervescent. Our house favorite for first-time tasters.',
    price: 6,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'ginger-lime',
    name: 'Ginger Lime Kombucha',
    description: 'Fresh ginger warmth balanced with bright citrus finish.',
    price: 7,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'berry-bloom',
    name: 'Berry Bloom Kombucha',
    description: 'A fruit-forward pour layered with blackberry and hibiscus notes.',
    price: 7,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'growler-refill',
    name: 'Growler Refill',
    description: 'Bring your clean Ferm Fresh growler and refill with any tap flavor.',
    price: 14,
    category: 'Refills',
    is_available: true,
  },
  {
    id: 'flight-kit',
    name: 'Flavor Flight Kit',
    description: 'Four rotating 8oz pours packed for easy pickup and tasting.',
    price: 16,
    category: 'Specials',
    is_available: true,
  },
];

const OWNER_EDITOR_CODE = process.env.NEXT_PUBLIC_OWNER_EDITOR_CODE || 'fermfresh-owner';

export default function Home() {
  const [menu, setMenu] = useState<MenuItem[]>(FALLBACK_MENU);
  const [cart, setCart] = useState<CartState>({});
  const [isLoadingMenu, setIsLoadingMenu] = useState(true);
  const [menuMessage, setMenuMessage] = useState('');
  const [orderMessage, setOrderMessage] = useState('');
  const [ownerMessage, setOwnerMessage] = useState('');

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupTime, setPickupTime] = useState('ASAP');
  const [orderNotes, setOrderNotes] = useState('');

  const [ownerPanelOpen, setOwnerPanelOpen] = useState(false);
  const [ownerCodeInput, setOwnerCodeInput] = useState('');
  const [ownerUnlocked, setOwnerUnlocked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadMenu() {
      setIsLoadingMenu(true);
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, description, price, category, is_available')
        .order('name');

      if (!isMounted) {
        return;
      }

      if (error || !data || data.length === 0) {
        setMenu(FALLBACK_MENU);
        setMenuMessage('Using starter menu data. Connect Supabase table menu_items to make this dynamic.');
      } else {
        const parsed = data.map((item) => ({
          id: String(item.id),
          name: item.name,
          description: item.description || '',
          price: Number(item.price),
          category: item.category || 'Menu',
          is_available: item.is_available !== false,
        }));
        setMenu(parsed);
      }

      setIsLoadingMenu(false);
    }

    loadMenu();

    return () => {
      isMounted = false;
    };
  }, []);

  const groupedMenu = useMemo(() => {
    return menu.reduce<Record<string, MenuItem[]>>((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [menu]);

  const cartItems = useMemo(() => {
    return menu
      .filter((item) => cart[item.id] && cart[item.id] > 0)
      .map((item) => ({ ...item, quantity: cart[item.id] }));
  }, [cart, menu]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  function changeQuantity(itemId: string, amount: number) {
    setCart((prev) => {
      const nextQty = (prev[itemId] || 0) + amount;
      if (nextQty <= 0) {
        const { [itemId]: _deleted, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: nextQty };
    });
  }

  async function submitOrder(event: FormEvent) {
    event.preventDefault();

    if (cartItems.length === 0) {
      setOrderMessage('Add at least one menu item before submitting your to-go order.');
      return;
    }

    setOrderMessage('Sending your order...');

    const payload = {
      customer_name: customerName,
      customer_phone: customerPhone,
      pickup_time: pickupTime,
      notes: orderNotes,
      order_items: cartItems.map((item) => ({
        id: item.id,
        name: item.name,
        qty: item.quantity,
        price: item.price,
      })),
      total: cartTotal,
      status: 'new',
    };

    const { error } = await supabase.from('orders').insert(payload);

    if (error) {
      setOrderMessage('Order saved locally only. Please call Ferm Fresh at (812) 555-0139 to confirm.');
      return;
    }

    setOrderMessage('Order submitted. Ferm Fresh will have your to-go order ready soon.');
    setCart({});
    setCustomerName('');
    setCustomerPhone('');
    setPickupTime('ASAP');
    setOrderNotes('');
  }

  function verifyOwnerCode(event: FormEvent) {
    event.preventDefault();
    if (ownerCodeInput === OWNER_EDITOR_CODE) {
      setOwnerUnlocked(true);
      setOwnerMessage('Owner mode enabled. You can now save menu changes.');
      return;
    }
    setOwnerMessage('Access code is incorrect.');
  }

  function updateLocalItem(id: string, updates: Partial<MenuItem>) {
    setMenu((prev) => prev.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  }

  async function saveItem(item: MenuItem) {
    setOwnerMessage(`Saving ${item.name}...`);

    const { error } = await supabase.from('menu_items').upsert({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      is_available: item.is_available,
    });

    if (error) {
      setOwnerMessage('Could not save to Supabase. Check menu_items table and permissions.');
      return;
    }

    setOwnerMessage(`${item.name} saved.`);
  }

  function addMenuItem() {
    const id = `custom-${Date.now()}`;
    const newItem: MenuItem = {
      id,
      name: 'New Menu Item',
      description: 'Describe this item for online ordering.',
      price: 0,
      category: 'Specials',
      is_available: true,
    };
    setMenu((prev) => [newItem, ...prev]);
  }

  return (
    <main className="mx-auto grid w-[min(1120px,96vw)] gap-3 py-4 text-[#221d18]">
      <header className="grid gap-3 lg:grid-cols-[1.35fr_0.9fr]">
        <div className="animate-[fadeup_0.55s_ease_forwards] rounded-2xl border border-[#c99a61] bg-gradient-to-br from-[#ffefd1] via-[#f3d19b] to-[#ecc286] p-6 shadow-[0_14px_24px_rgba(15,32,26,0.18)]">
          <p className="mb-2 inline-block rounded-full border border-[#1f5a4f]/40 bg-[#f4e4c2] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#1f5a4f]">
            Terre Haute Crafted Kombucha
          </p>
          <h1 className="font-[var(--font-display)] text-5xl font-extrabold leading-none text-[#113f37] sm:text-6xl">
            Ferm Fresh
          </h1>
          <p className="mt-3 max-w-2xl text-[1.02rem] leading-relaxed text-[#2d251d]">
            Fresh-brewed kombucha made in small batches for our local community. We keep it simple:
            clean ingredients, rotating flavors, and fast to-go pickup.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href="#order"
              className="rounded-full bg-[#113f37] px-5 py-2 text-sm font-bold text-[#fdf6e9] transition hover:-translate-y-0.5"
            >
              Order To-Go
            </a>
            <a
              href="https://www.google.com/maps/dir/?api=1&destination=Ferm+Fresh+Terre+Haute+Indiana"
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-[#113f37] px-5 py-2 text-sm font-bold text-[#113f37] transition hover:-translate-y-0.5"
            >
              Find Us
            </a>
          </div>
        </div>

        <aside className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:110ms] rounded-2xl border border-[#255347] bg-gradient-to-b from-[#1b4e45] to-[#143a33] p-5 text-[#f3e8d2] shadow-[0_14px_24px_rgba(15,32,26,0.18)]">
          <h2 className="font-[var(--font-display)] text-2xl font-bold">Visit Ferm Fresh</h2>
          <p>Terre Haute, Indiana</p>
          <p>Mon - Fri: 11:00 AM - 7:00 PM</p>
          <p>Sat: 10:00 AM - 5:00 PM</p>
          <p>Sun: Closed</p>
          <a className="mt-2 inline-block font-semibold underline decoration-2" href="tel:+18125550139">
            Call for same-day pickup: (812) 555-0139
          </a>
        </aside>
      </header>

      <section className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:140ms] rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-5 shadow-[0_12px_20px_rgba(15,32,26,0.18)]">
        <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">What Is Ferm Fresh?</h2>
        <p className="mt-2 max-w-4xl leading-relaxed">
          Ferm Fresh is a local kombucha company focused on flavor, consistency, and wellness.
          Whether you are grabbing a bottle on your lunch break or refilling a growler for the
          week, we are here to keep Terre Haute stocked with living beverages.
        </p>
        <p className="mt-2 text-sm font-semibold text-[#3f3228]">
          Learn more about Ferm Fresh, Anthony, and Megan here:{' '}
          <a
            href="https://fermfreshkombucha.com/"
            target="_blank"
            rel="noreferrer"
            className="text-[#113f37] underline decoration-2 underline-offset-2"
          >
            Ferm Fresh Contact Us
          </a>
        </p>
      </section>

      <section id="order" className="grid gap-3 lg:grid-cols-[1.35fr_0.92fr]">
        <div className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:170ms] rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-4 shadow-[0_12px_20px_rgba(15,32,26,0.18)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">Menu</h2>
            {isLoadingMenu ? <span className="text-sm text-[#5b4630]">Loading menu...</span> : null}
          </div>
          {menuMessage ? <p className="mt-1 text-sm text-[#5b4630]">{menuMessage}</p> : null}

          {Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category} className="mt-3">
              <h3 className="font-[var(--font-display)] text-xl font-bold text-[#1f5a4f]">{category}</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <article
                    key={item.id}
                    className={`grid gap-2 rounded-xl border border-[#d2b48d] bg-[#fff7e6] p-3 ${
                      item.is_available ? '' : 'opacity-55'
                    }`}
                  >
                    <div>
                      <h4 className="font-[var(--font-display)] text-lg font-semibold text-[#113f37]">{item.name}</h4>
                      <p className="mt-1 text-sm leading-relaxed text-[#463a2f]">{item.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <strong className="text-sm text-[#113f37]">${item.price.toFixed(2)}</strong>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg bg-[#2f7a5f] text-white"
                          onClick={() => changeQuantity(item.id, -1)}
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold">{cart[item.id] || 0}</span>
                        <button
                          type="button"
                          className="h-8 w-8 rounded-lg bg-[#2f7a5f] text-white disabled:cursor-not-allowed disabled:opacity-45"
                          onClick={() => changeQuantity(item.id, 1)}
                          disabled={!item.is_available}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        <aside className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:210ms] self-start rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-4 shadow-[0_12px_20px_rgba(15,32,26,0.18)] lg:sticky lg:top-3">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">Your To-Go Order</h2>

          <ul className="mt-3 grid gap-1.5">
            {cartItems.length === 0 ? <li className="text-sm text-[#5b4630]">Your cart is empty.</li> : null}
            {cartItems.map((item) => (
              <li key={item.id} className="flex justify-between gap-2 text-sm">
                <span>{item.quantity} x {item.name}</span>
                <span>${(item.quantity * item.price).toFixed(2)}</span>
              </li>
            ))}
          </ul>

          <p className="mb-3 mt-3 font-bold">Total: ${cartTotal.toFixed(2)}</p>

          <form onSubmit={submitOrder} className="grid gap-2">
            <label className="grid gap-1 text-sm font-semibold text-[#3c3026]">
              Name
              <input
                required
                className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Your full name"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[#3c3026]">
              Phone
              <input
                required
                className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                value={customerPhone}
                onChange={(event) => setCustomerPhone(event.target.value)}
                placeholder="Best number for pickup"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[#3c3026]">
              Pickup time
              <input
                className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                value={pickupTime}
                onChange={(event) => setPickupTime(event.target.value)}
                placeholder="ASAP or 5:30 PM"
              />
            </label>
            <label className="grid gap-1 text-sm font-semibold text-[#3c3026]">
              Notes
              <textarea
                rows={3}
                className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                value={orderNotes}
                onChange={(event) => setOrderNotes(event.target.value)}
                placeholder="Allergies, special pickup instructions, etc."
              />
            </label>
            <button
              type="submit"
              className="mt-1 rounded-full bg-[#113f37] px-4 py-2 text-sm font-bold text-[#fdf6e9] transition hover:-translate-y-0.5"
            >
              Place Order
            </button>
          </form>
          {orderMessage ? <p className="mt-2 text-sm text-[#5b4630]">{orderMessage}</p> : null}
        </aside>
      </section>

      <section className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:260ms] grid gap-3 rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-4 shadow-[0_12px_20px_rgba(15,32,26,0.18)]">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">Owner Menu Editor</h2>
          <button
            type="button"
            className="rounded-full border border-[#113f37] px-4 py-2 text-sm font-bold text-[#113f37]"
            onClick={() => setOwnerPanelOpen((prev) => !prev)}
          >
            {ownerPanelOpen ? 'Hide Editor' : 'Open Editor'}
          </button>
        </div>

        {ownerPanelOpen ? (
          <>
            {!ownerUnlocked ? (
              <form onSubmit={verifyOwnerCode} className="flex flex-wrap items-end gap-2">
                <label className="grid min-w-[220px] gap-1 text-sm font-semibold text-[#3c3026]">
                  Owner access code
                  <input
                    className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                    value={ownerCodeInput}
                    onChange={(event) => setOwnerCodeInput(event.target.value)}
                    placeholder="Enter owner code"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-[#113f37] px-4 py-2 text-sm font-bold text-[#fdf6e9]"
                >
                  Unlock
                </button>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="w-fit rounded-full bg-[#113f37] px-4 py-2 text-sm font-bold text-[#fdf6e9]"
                  onClick={addMenuItem}
                >
                  Add Item
                </button>
                <div className="grid gap-2">
                  {menu.map((item) => (
                    <article key={item.id} className="grid gap-2 rounded-xl border border-[#d8bc97] bg-[#fffaf0] p-3">
                      <input
                        className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                        value={item.name}
                        onChange={(event) => updateLocalItem(item.id, { name: event.target.value })}
                      />
                      <input
                        className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                        value={item.category}
                        onChange={(event) => updateLocalItem(item.id, { category: event.target.value })}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                        value={item.price}
                        onChange={(event) => updateLocalItem(item.id, { price: Number(event.target.value) })}
                      />
                      <textarea
                        rows={2}
                        className="rounded-lg border border-[#bf9e74] bg-[#fffdf8] px-3 py-2 text-sm"
                        value={item.description}
                        onChange={(event) => updateLocalItem(item.id, { description: event.target.value })}
                      />
                      <label className="flex items-center gap-2 text-sm font-medium text-[#3c3026]">
                        <input
                          type="checkbox"
                          checked={item.is_available}
                          onChange={(event) => updateLocalItem(item.id, { is_available: event.target.checked })}
                        />
                        Available
                      </label>
                      <button
                        type="button"
                        className="w-fit rounded-full border border-[#113f37] px-4 py-2 text-sm font-bold text-[#113f37]"
                        onClick={() => saveItem(item)}
                      >
                        Save Item
                      </button>
                    </article>
                  ))}
                </div>
              </>
            )}
            {ownerMessage ? <p className="text-sm text-[#5b4630]">{ownerMessage}</p> : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
