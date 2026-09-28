"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [store, setStore] = useState(null);
  const [stats, setStats] = useState({
    followers: 0,
    products: 0,
    posts: 0,
    likes: 0,
    comments: 0,
    chats: 0,
  });
  const [products, setProducts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser(currentUser);

      const { data: currentProfile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .single();

      if (profileError) throw profileError;

      setProfile(currentProfile);

      const { data: currentStore, error: storeError } = await supabase
        .from("stores")
        .select("*")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (storeError) throw storeError;

      setStore(currentStore);

      // Buyers without a store get a buyer-oriented dashboard.
      if (!currentStore) {
        await loadBuyerDashboard(currentUser.id);
        setLoading(false);
        return;
      }

      await loadSellerDashboard(currentUser.id, currentStore.id);
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(err.message || "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  }

  async function loadBuyerDashboard(userId) {
    const { data: follows } = await supabase
      .from("follows")
      .select("followed_store_id")
      .eq("follower_id", userId)
      .limit(6);

    const followedStoreIds = (follows || []).map(
      (item) => item.followed_store_id
    );

    let followedStores = [];

    if (followedStoreIds.length > 0) {
      const { data } = await supabase
        .from("stores")
        .select("id, name, logo_url, verified")
        .in("id", followedStoreIds)
        .limit(6);

      followedStores = data || [];
    }

    setStats({
      followers: 0,
      products: 0,
      posts: 0,
      likes: 0,
      comments: 0,
      chats: 0,
    });

    setProducts(followedStores);
    setPosts([]);
    setMessages([]);
  }

  async function loadSellerDashboard(userId, storeId) {
    const [
      followersResult,
      productsResult,
      postsResult,
      messagesResult,
    ] = await Promise.all([
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("followed_store_id", storeId),

      supabase
        .from("products")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false }),

      supabase
        .from("posts")
        .select(
          `
            id,
            media_url,
            media_type,
            caption,
            created_at,
            likes(count),
            comments(count)
          `
        )
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(6),

      supabase
        .from("conversations")
        .select("*")
        .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
        .order("last_message_at", { ascending: false })
        .limit(5),
    ]);

    if (followersResult.error) {
      console.error("Followers error:", followersResult.error);
    }

    if (productsResult.error) {
      console.error("Products error:", productsResult.error);
    }

    if (postsResult.error) {
      console.error("Posts error:", postsResult.error);
    }

    if (messagesResult.error) {
      console.error("Messages error:", messagesResult.error);
    }

    const productRows = productsResult.data || [];
    const postRows = postsResult.data || [];
    const messageRows = messagesResult.data || [];

    const likes = postRows.reduce(
      (total, post) => total + getRelationCount(post.likes),
      0
    );

    const comments = postRows.reduce(
      (total, post) => total + getRelationCount(post.comments),
      0
    );

    setStats({
      followers: followersResult.count || 0,
      products: productRows.length,
      posts: postRows.length,
      likes,
      comments,
      chats: messageRows.length,
    });

    setProducts(productRows);
    setPosts(postRows);
    setMessages(messageRows);
  }

  function getRelationCount(value) {
    if (!value) return 0;

    if (Array.isArray(value)) {
      return value.reduce((total, item) => {
        if (typeof item === "number") return total + item;
        return total + (item?.count || 0);
      }, 0);
    }

    if (typeof value === "number") return value;

    return value.count || 0;
  }

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = Number(product.stock_qty ?? product.stock ?? 0);
      return stock <= 5;
    });
  }, [products]);

  const totalLikes = stats.likes;
  const totalComments = stats.comments;

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.loading}>Loading dashboard...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main style={styles.page}>
        <div style={styles.errorBox}>
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
          <button onClick={loadDashboard} style={styles.primaryButton}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  // BUYER DASHBOARD
  if (!store) {
    return (
      <main style={styles.page}>
        <section style={styles.hero}>
          <div>
            <p style={styles.eyebrow}>HOME</p>
            <h1 style={styles.title}>
              Welcome back{profile?.name ? `, ${profile.name}` : ""}
            </h1>
            <p style={styles.subtitle}>
              Discover stores, products and people worth following.
            </p>
          </div>
        </section>

        <section style={styles.quickGrid}>
          <Link href="/feed" style={styles.actionCard}>
            <span style={styles.actionIcon}>⌂</span>
            <strong>Discover Feed</strong>
            <small>Explore products and stores</small>
          </Link>

          <Link href="/messages" style={styles.actionCard}>
            <span style={styles.actionIcon}>✉</span>
            <strong>Messages</strong>
            <small>Chat with sellers</small>
          </Link>

          <Link href="/products" style={styles.actionCard}>
            <span style={styles.actionIcon}>⌕</span>
            <strong>Browse Products</strong>
            <small>Search the marketplace</small>
          </Link>

          <Link href="/settings" style={styles.actionCard}>
            <span style={styles.actionIcon}>◯</span>
            <strong>Profile</strong>
            <small>Manage your account</small>
          </Link>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Following</h2>
              <p style={styles.sectionSubtitle}>
                Stores you currently follow
              </p>
            </div>
          </div>

          {products.length === 0 ? (
            <div style={styles.empty}>
              <p>You aren't following any stores yet.</p>
              <Link href="/feed" style={styles.primaryButton}>
                Discover stores
              </Link>
            </div>
          ) : (
            <div style={styles.storeGrid}>
              {products.map((followedStore) => (
                <Link
                  key={followedStore.id}
                  href={`/stores/${followedStore.id}`}
                  style={styles.storeCard}
                >
                  <div style={styles.storeAvatar}>
                    {followedStore.logo_url ? (
                      <img
                        src={followedStore.logo_url}
                        alt=""
                        style={styles.avatarImage}
                      />
                    ) : (
                      "B"
                    )}
                  </div>

                  <div>
                    <strong>{followedStore.name}</strong>
                    {followedStore.verified && (
                      <span style={styles.verified}>✓</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    );
  }

  // SELLER DASHBOARD
  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>MY STORE</p>

          <div style={styles.storeHeading}>
            <h1 style={styles.title}>{store.name}</h1>

            {store.verified && (
              <span style={styles.verifiedBadge}>✓ Verified</span>
            )}
          </div>

          {store.description && (
            <p style={styles.subtitle}>{store.description}</p>
          )}

          {store.category && (
            <span style={styles.category}>{store.category}</span>
          )}
        </div>

        <Link href={`/stores/${store.id}`} style={styles.secondaryButton}>
          View store
        </Link>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Followers" value={stats.followers} />
        <StatCard label="Products" value={stats.products} />
        <StatCard label="Posts" value={stats.posts} />
        <StatCard label="Likes" value={totalLikes} />
        <StatCard label="Comments" value={totalComments} />
        <StatCard label="Chats" value={stats.chats} />
      </section>

      <section style={styles.quickGrid}>
        <Link href="/dashboard/products/new" style={styles.actionCard}>
          <span style={styles.actionIcon}>＋</span>
          <strong>Add Product</strong>
          <small>Add something new to your store</small>
        </Link>

        <Link href="/dashboard/posts/new" style={styles.actionCard}>
          <span style={styles.actionIcon}>＋</span>
          <strong>Create Post</strong>
          <small>Share something with your audience</small>
        </Link>

        <Link href="/dashboard/verify" style={styles.actionCard}>
          <span style={styles.actionIcon}>✓</span>
          <strong>Verification</strong>
          <small>
            {store.verification_status === "approved"
              ? "Your store is verified"
              : store.verification_status === "pending"
              ? "Verification is under review"
              : "Verify your store"}
          </small>
        </Link>

        <Link href="/settings" style={styles.actionCard}>
          <span style={styles.actionIcon}>⚙</span>
          <strong>Settings</strong>
          <small>Manage your profile</small>
        </Link>
      </section>

      {lowStockProducts.length > 0 && (
        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <div>
              <h2 style={styles.sectionTitle}>Stock Alerts</h2>
              <p style={styles.sectionSubtitle}>
                Products that may need your attention
              </p>
            </div>
          </div>

          <div style={styles.alertList}>
            {lowStockProducts.slice(0, 5).map((product) => {
              const stock = Number(
                product.stock_qty ?? product.stock ?? 0
              );

              return (
                <div key={product.id} style={styles.alertRow}>
                  <div>
                    <strong>{product.title}</strong>
                    <p style={styles.muted}>
                      {stock === 0 ? "Out of stock" : `${stock} left`}
                    </p>
                  </div>

                  <Link
                    href={`/products/${product.id}`}
                    style={styles.smallButton}
                  >
                    View
                  </Link>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Recent Products</h2>
            <p style={styles.sectionSubtitle}>
              Your latest products
            </p>
          </div>

          <Link href="/products" style={styles.textLink}>
            View all
          </Link>
        </div>

        {products.length === 0 ? (
          <div style={styles.empty}>
            <p>You haven't added any products yet.</p>
            <Link href="/dashboard/products/new" style={styles.primaryButton}>
              Add your first product
            </Link>
          </div>
        ) : (
          <div style={styles.productGrid}>
            {products.slice(0, 6).map((product) => {
              const stock = Number(
                product.stock_qty ?? product.stock ?? 0
              );

              return (
                <Link
                  href={`/products/${product.id}`}
                  key={product.id}
                  style={styles.productCard}
                >
                  <div style={styles.productImage}>
                    {getProductImage(product) ? (
                      <img
                        src={getProductImage(product)}
                        alt={product.title}
                        style={styles.coverImage}
                      />
                    ) : (
                      <span>No image</span>
                    )}
                  </div>

                  <div style={styles.productInfo}>
                    <strong>{product.title}</strong>

                    <div style={styles.productMeta}>
                      <span>
                        ₦{Number(product.price || 0).toLocaleString()}
                      </span>

                      <span
                        style={{
                          ...styles.stock,
                          ...(stock <= 0
                            ? styles.stockOut
                            : stock <= 5
                            ? styles.stockLow
                            : {}),
                        }}
                      >
                        {stock <= 0 ? "Out" : `${stock} in stock`}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Recent Posts</h2>
            <p style={styles.sectionSubtitle}>
              How your content is performing
            </p>
          </div>
        </div>

        {posts.length === 0 ? (
          <div style={styles.empty}>
            <p>You haven't created any posts yet.</p>
            <Link href="/dashboard/posts/new" style={styles.primaryButton}>
              Create a post
            </Link>
          </div>
        ) : (
          <div style={styles.postGrid}>
            {posts.map((post) => (
              <Link href="/feed" key={post.id} style={styles.postCard}>
                <div style={styles.postMedia}>
                  {post.media_type === "video" ? (
                    <video
                      src={post.media_url}
                      muted
                      playsInline
                      preload="metadata"
                      style={styles.coverImage}
                    />
                  ) : (
                    <img
                      src={post.media_url}
                      alt=""
                      style={styles.coverImage}
                    />
                  )}
                </div>

                <div style={styles.postInfo}>
                  <p>{post.caption || "No caption"}</p>

                  <div style={styles.engagement}>
                    <span>♥ {getRelationCount(post.likes)}</span>
                    <span>💬 {getRelationCount(post.comments)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section style={styles.section}>
        <div style={styles.sectionHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Recent Messages</h2>
            <p style={styles.sectionSubtitle}>
              Conversations with buyers
            </p>
          </div>

          <Link href="/messages" style={styles.textLink}>
            Open inbox
          </Link>
        </div>

        {messages.length === 0 ? (
          <div style={styles.empty}>
            <p>No conversations yet.</p>
          </div>
        ) : (
          <div style={styles.messageList}>
            {messages.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/messages/${conversation.id}`}
                style={styles.messageRow}
              >
                <div style={styles.messageAvatar}>●</div>

                <div style={styles.messageContent}>
                  <strong>
                    {conversation.buyer_id === user?.id
                      ? "Seller"
                      : "Buyer"}
                  </strong>

                  <p>
                    Open conversation
                  </p>
                </div>

                <span style={styles.messageArrow}>›</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <strong>{Number(value || 0).toLocaleString()}</strong>
      <span>{label}</span>
    </div>
  );
}

function getProductImage(product) {
  if (!product) return null;

  if (Array.isArray(product.photos) && product.photos.length > 0) {
    return product.photos[0];
  }

  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images[0];
  }

  if (typeof product.image_url === "string") {
    return product.image_url;
  }

  if (typeof product.photo_url === "string") {
    return product.photo_url;
  }

  return null;
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: "32px 20px 100px",
    maxWidth: "1200px",
    margin: "0 auto",
  },

  loading: {
    minHeight: "60vh",
    display: "grid",
    placeItems: "center",
    fontSize: "16px",
  },

  errorBox: {
    maxWidth: "600px",
    margin: "80px auto",
    padding: "24px",
    borderRadius: "18px",
    background: "#fff",
    border: "1px solid #eaded6",
  },

  hero: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    marginBottom: "28px",
  },

  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    opacity: 0.6,
  },

  title: {
    margin: "5px 0 8px",
    fontSize: "clamp(28px, 5vw, 42px)",
    lineHeight: 1.1,
  },

  subtitle: {
    margin: 0,
    maxWidth: "650px",
    opacity: 0.7,
    lineHeight: 1.6,
  },

  storeHeading: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },

  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "12px",
    fontWeight: 700,
    background: "#edf7ef",
    color: "#27733a",
  },

  verified: {
    marginLeft: "6px",
    color: "#27733a",
    fontWeight: 700,
  },

  category: {
    display: "inline-block",
    marginTop: "12px",
    padding: "6px 10px",
    borderRadius: "999px",
    background: "#f1ebe6",
    fontSize: "12px",
  },

  primaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    padding: "0 16px",
    borderRadius: "10px",
    background: "#b76545",
    color: "#fff",
    textDecoration: "none",
    border: 0,
    cursor: "pointer",
    fontWeight: 700,
  },

  secondaryButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "42px",
    padding: "0 16px",
    borderRadius: "10px",
    border: "1px solid #ded1c8",
    color: "inherit",
    textDecoration: "none",
    background: "#fff",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "24px",
  },

  statCard: {
    padding: "18px 14px",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid #eaded6",
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  statCardStrong: {
    fontSize: "24px",
  },

  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: "12px",
    marginBottom: "32px",
  },

  actionCard: {
    padding: "18px",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid #eaded6",
    color: "inherit",
    textDecoration: "none",
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    transition: "transform .15s ease",
  },

  actionIcon: {
    width: "34px",
    height: "34px",
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    background: "#f1ebe6",
    fontSize: "18px",
    marginBottom: "4px",
  },

  section: {
    marginTop: "32px",
  },

  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    marginBottom: "14px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "20px",
  },

  sectionSubtitle: {
    margin: "4px 0 0",
    opacity: 0.6,
    fontSize: "13px",
  },

  textLink: {
    color: "#b76545",
    fontWeight: 700,
    textDecoration: "none",
    fontSize: "14px",
  },

  empty: {
    padding: "30px",
    textAlign: "center",
    borderRadius: "16px",
    border: "1px dashed #d8c8bd",
    background: "#fff",
  },

  productGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },

  productCard: {
    overflow: "hidden",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid #eaded6",
    color: "inherit",
    textDecoration: "none",
  },

  productImage: {
    aspectRatio: "1 / 1",
    background: "#f1ebe6",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
  },

  coverImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },

  productInfo: {
    padding: "14px",
  },

  productMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "8px",
    fontSize: "14px",
  },

  stock: {
    fontSize: "12px",
    padding: "4px 7px",
    borderRadius: "999px",
    background: "#edf7ef",
    color: "#27733a",
  },

  stockLow: {
    background: "#fff5dd",
    color: "#8b6400",
  },

  stockOut: {
    background: "#fdeaea",
    color: "#a52c2c",
  },

  alertList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  alertRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "16px",
    padding: "14px 16px",
    background: "#fff",
    border: "1px solid #eaded6",
    borderRadius: "14px",
  },

  muted: {
    margin: "4px 0 0",
    opacity: 0.6,
    fontSize: "13px",
  },

  smallButton: {
    padding: "7px 11px",
    borderRadius: "8px",
    background: "#f1ebe6",
    color: "inherit",
    textDecoration: "none",
    fontSize: "12px",
    fontWeight: 700,
  },

  postGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "14px",
  },

  postCard: {
    overflow: "hidden",
    borderRadius: "16px",
    background: "#fff",
    border: "1px solid #eaded6",
    color: "inherit",
    textDecoration: "none",
  },

  postMedia: {
    aspectRatio: "1 / 1",
    overflow: "hidden",
    background: "#f1ebe6",
  },

  postInfo: {
    padding: "12px",
  },

  engagement: {
    display: "flex",
    gap: "16px",
    marginTop: "8px",
    fontSize: "12px",
    opacity: 0.7,
  },

  messageList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  messageRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "#fff",
    border: "1px solid #eaded6",
    borderRadius: "14px",
    color: "inherit",
    textDecoration: "none",
  },

  messageAvatar: {
    width: "38px",
    height: "38px",
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#f1ebe6",
  },

  messageContent: {
    flex: 1,
  },

  messageContentP: {
    margin: "3px 0 0",
    opacity: 0.6,
    fontSize: "13px",
  },

  messageArrow: {
    fontSize: "22px",
    opacity: 0.5,
  },

  storeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "12px",
  },

  storeCard: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px",
    borderRadius: "14px",
    background: "#fff",
    border: "1px solid #eaded6",
    color: "inherit",
    textDecoration: "none",
  },

  storeAvatar: {
    width: "44px",
    height: "44px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",
    borderRadius: "50%",
    background: "#f1ebe6",
    fontWeight: 700,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
};
