'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { supabase } from '../lib/supabase';
import frontWelcomeImage from '../img/front welcome.jpeg';
import frontImage from '../img/front.jpeg';
import insideImage from '../img/inside.jpeg';
import insideTwoImage from '../img/inside 2.jpeg';

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  is_available: boolean;
};

type CartState = Record<string, number>;

const INDIANA_SALES_TAX_RATE = 0.07;

const FLAVOR_MENU = [
  'Blueberry Lavender',
  'Strawberry Charmoile',
  'Butterfly Rose',
  'Mango Hops',
  'Hibiscus Lemonade',
  'Elderflower Orange',
  'Ginger',
  'Cranberry',
  'Peach',
  'Jungle Juice',
  'Sour Pom Apple',
];

const SMOOTHIE_FLAVOR_MENU = ['Cherries & Berries', 'Green Machine', 'Tropic Blue', 'Golden Girl'];

const FALLBACK_MENU: MenuItem[] = [
  {
    id: 'kombucha-8oz',
    name: 'Kombucha (8oz)',
    description: 'Fresh-brewed kombucha in an 8oz serving.',
    price: 4,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'kombucha-16oz',
    name: 'Kombucha (16oz)',
    description: 'Fresh-brewed kombucha in a 16oz serving.',
    price: 6,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'kombucha-slushie',
    name: 'Slushie',
    description: 'Frozen kombucha slushie for a bright, refreshing treat.',
    price: 7.5,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'kombucha-smoothie',
    name: 'Smoothie',
    description: 'Kombucha smoothie blended smooth and served chilled. Add protein and collagen for $2. Non-dairy options are available.',
    price: 8,
    category: 'Kombucha',
    is_available: true,
  },
  {
    id: 'growler-refill-16oz',
    name: 'Growler Refill (16oz)',
    description: '16oz refill. Bring your clean Ferm Fresh growler and choose any tap flavor.',
    price: 6,
    category: 'Refills',
    is_available: true,
  },
  {
    id: 'growler-refill-32oz',
    name: 'Growler Refill (32oz)',
    description: '32oz refill. Bring your clean Ferm Fresh growler and choose any tap flavor.',
    price: 18,
    category: 'Refills',
    is_available: true,
  },
  {
    id: 'growler-refill-64oz',
    name: 'Growler Refill (64oz)',
    description: '64oz refill. Bring your clean Ferm Fresh growler and choose any tap flavor.',
    price: 25,
    category: 'Refills',
    is_available: true,
  },
  {
    id: 'flight-kit',
    name: 'Flavor Flight Kit',
    description: 'Choose six flavors to try in 2oz glasses! Perfect for tasting or sharing with a friend.',
    price: 10,
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

  const cartSubtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cartItems]);

  const salesTax = useMemo(() => {
    return Math.round(cartSubtotal * INDIANA_SALES_TAX_RATE * 100) / 100;
  }, [cartSubtotal]);

  const orderTotal = useMemo(() => {
    return Math.round((cartSubtotal + salesTax) * 100) / 100;
  }, [cartSubtotal, salesTax]);

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
      total: orderTotal,
      status: 'new',
    };

    const { error } = await supabase.from('orders').insert(payload);

    if (error) {
      setOrderMessage('Order saved locally only. Please stop by Ferm Fresh at 1616 Poplar St, Terre Haute, IN 47803 to confirm.');
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
          <p>Thurs: 12:00 PM - 5:00 PM</p>
          <p>Fri: 12:00 PM - 5:00 PM</p>
          <p>Sat: 12:00 PM - 5:00 PM</p>
          <a
            className="mt-2 inline-block font-semibold underline decoration-2"
            href="https://www.google.com/maps/search/?api=1&query=1616+Poplar+St,+Terre+Haute,+IN+47803"
            target="_blank"
            rel="noreferrer"
          >
            Pickup address: 1616 Poplar St, Terre Haute, IN 47803
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

      <section className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:155ms] rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-5 shadow-[0_12px_20px_rgba(15,32,26,0.18)]">
        <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">Flavor Menu</h2>
        <p className="mt-2 text-sm font-semibold text-[#3f3228]">Current kombucha flavors on rotation:</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {FLAVOR_MENU.map((flavor) => (
            <li key={flavor} className="rounded-lg border border-[#d2b48d] bg-[#fff7e6] px-3 py-2 text-sm font-medium text-[#2d251d]">
              {flavor}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm font-semibold text-[#3f3228]">Smoothie flavors:</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {SMOOTHIE_FLAVOR_MENU.map((flavor) => (
            <li key={flavor} className="rounded-lg border border-[#d2b48d] bg-[#fff7e6] px-3 py-2 text-sm font-medium text-[#2d251d]">
              {flavor}
            </li>
          ))}
        </ul>
      </section>

      <section className="animate-[fadeup_0.55s_ease_forwards] [animation-delay:165ms] rounded-2xl border border-[#c99a61] bg-[#fff8eb] p-5 shadow-[0_12px_20px_rgba(15,32,26,0.18)]">
        <h2 className="font-[var(--font-display)] text-3xl font-bold text-[#113f37]">Inside Ferm Fresh</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#3f3228]">
          A few photos from the front entrance and inside the shop to give the page a warmer, more inviting feel.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { src: frontWelcomeImage, alt: 'Front of Ferm Fresh with welcome sign', caption: 'Front welcome' },
            { src: frontImage, alt: 'Front of Ferm Fresh store exterior', caption: 'Front of store' },
            { src: insideImage, alt: 'Inside Ferm Fresh shop interior', caption: 'Inside view' },
            { src: insideTwoImage, alt: 'Another interior photo of Ferm Fresh', caption: 'Inside view two' },
          ].map((image) => (
            <figure key={image.caption} className="overflow-hidden rounded-xl border border-[#d2b48d] bg-[#fff7e6] shadow-[0_10px_18px_rgba(15,32,26,0.12)]">
              <Image src={image.src} alt={image.alt} className="h-56 w-full object-cover" />
              <figcaption className="px-3 py-2 text-sm font-semibold text-[#2d251d]">{image.caption}</figcaption>
            </figure>
          ))}
        </div>
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

          <div className="mb-3 mt-3 grid gap-1 text-sm">
            <p className="flex justify-between">
              <span>Subtotal</span>
              <span>${cartSubtotal.toFixed(2)}</span>
            </p>
            <p className="flex justify-between">
              <span>Indiana sales tax (7%)</span>
              <span>${salesTax.toFixed(2)}</span>
            </p>
            <p className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>${orderTotal.toFixed(2)}</span>
            </p>
          </div>

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
