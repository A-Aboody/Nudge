import {
  Box,
  Flex,
  Text,
  VStack,
  HStack,
  Icon,
  Button,
  Input,
  Image,
  useColorModeValue,
} from "@chakra-ui/react";
import {
  FiPlus,
  FiEdit3,
  FiArrowRight,
  FiCheckSquare,
  FiSquare,
  FiCalendar,
  FiX,
  FiGlobe,
} from "react-icons/fi";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { Reorder, useDragControls } from "framer-motion";
import { scheduleAllReminders, clearAllScheduledReminders, updateAppBadge } from "../../services/notifications";
import SpotifyWidget from "../../custom_components/SpotifyWidget/SpotifyWidget";
import { useAuth } from "../../context/AuthContext";
import {
  loadTodos as dbLoadTodos, saveTodos as dbSaveTodos,
  loadNotes as dbLoadNotes,
  loadEvents as dbLoadEvents,
  loadBookmarks as dbLoadBookmarks, saveBookmarks as dbSaveBookmarks,
  loadSettings as dbLoadSettings, saveSettings as dbSaveSettings,
} from "../../services/db";

const DEFAULT_ORDER = ["bookmarks", "bills", "tasks", "notes", "quickAdd", "spotify"];

const getGreeting = (name) => {
  const h = new Date().getHours();
  const day = new Date().getDay();
  const suffix = name ? `, ${name}` : "";

  const pool = [];

  if (h < 5) {
    pool.push(`Up late${suffix}`, `Hey${suffix}`);
  } else if (h < 12) {
    pool.push(`Good morning${suffix}`, `Morning${suffix}`);
  } else if (h < 17) {
    pool.push(`Good afternoon${suffix}`, `Afternoon${suffix}`);
  } else {
    pool.push(`Good evening${suffix}`, `Evening${suffix}`);
  }

  if (day === 5 && h >= 12) pool.push(`Happy Friday${suffix}`);
  if (day === 0 || day === 6) pool.push(`Hey${suffix}`);
  if (day === 1 && h < 12) pool.push(`Welcome back${suffix}`);

  const seed = new Date().getHours() + new Date().getDate();
  return pool[seed % pool.length];
};

const getFormattedDate = () =>
  new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

// --- Helpers ---

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// --- Drag Handle ---

const DragHandle = ({ dragControls }) => (
  <Flex
    className="widget-drag-handle"
    direction="column"
    gap="2px"
    align="center"
    justify="center"
    py={1}
    px={1}
    mr={2}
    flexShrink={0}
    aria-label="Drag to reorder"
    onPointerDown={(e) => { if (dragControls) dragControls.start(e); }}
    style={{ touchAction: "none" }}
  >
    {[0, 1, 2].map((i) => (
      <Flex key={i} gap="3px">
        <Box w="3px" h="3px" borderRadius="full" bg="text.tertiary" />
        <Box w="3px" h="3px" borderRadius="full" bg="text.tertiary" />
      </Flex>
    ))}
  </Flex>
);

// --- Widget Wrapper ---

const WidgetShell = ({ title, linkText, linkTo, children, dragControls }) => (
  <Box className="widget-card" w="full" h="full" overflow="hidden">
    <Flex align="center" mb={4}>
      <DragHandle dragControls={dragControls} />
      <Text fontSize="xs" fontWeight="600" color="text.secondary" letterSpacing="0.08em" textTransform="uppercase">
        {title}
      </Text>
      {linkText && (
        <Button
          as={RouterLink}
          to={linkTo}
          size="xs"
          variant="ghost"
          color="text.tertiary"
          _hover={{ color: "primary" }}
          fontWeight="400"
          fontSize="xs"
          ml="auto"
          px={0}
          rightIcon={<FiArrowRight size={10} />}
        >
          {linkText}
        </Button>
      )}
    </Flex>
    {children}
  </Box>
);

// --- Individual Widgets ---

const EventsWidget = ({ allEvents, dragControls }) => {
  const navigate = useNavigate();
  const events = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allEvents
      .filter((e) => e.date >= today && !e.isHoliday)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || "").localeCompare(b.startTime || ""))
      .slice(0, 4);
  }, [allEvents]);

  return (
    <WidgetShell title="Events" linkText="View All" linkTo="/calendar" dragControls={dragControls}>
      {events.length > 0 ? (
        <VStack spacing={0} w="full">
          {events.map((event, i) => (
            <Flex
              key={event.id}
              w="full"
              py={2.5}
              align="center"
              justify="space-between"
              borderTop={i > 0 ? "1px solid" : "none"}
              borderColor="border"
              cursor="pointer"
              _hover={{ bg: "bg.hover" }}
              mx={-2}
              px={2}
              borderRadius="4px"
              transition="background 0.1s ease"
              onClick={() => navigate("/calendar")}
            >
              <HStack spacing={2.5} minW={0} flex={1}>
                <Icon as={FiCalendar} boxSize={3.5} color="text.tertiary" flexShrink={0} />
                <Text fontSize="sm" color="text" fontWeight="400" noOfLines={1}>{event.title || "Untitled"}</Text>
              </HStack>
              <Text fontSize="xs" color="text.tertiary" flexShrink={0} ml={2}>{formatDate(event.date)}</Text>
            </Flex>
          ))}
        </VStack>
      ) : (
        <Text fontSize="sm" color="text.tertiary">No upcoming events</Text>
      )}
    </WidgetShell>
  );
};

const TasksWidget = ({ tasks, onToggle, onTaskClick, totalCount, doneCount, dragControls }) => {
  const sorted = useMemo(() => [
    ...tasks.filter((t) => !t.completed),
    ...tasks.filter((t) => t.completed),
  ], [tasks]);

  return (
    <WidgetShell title="Tasks" linkText="View All" linkTo="/todo" dragControls={dragControls}>
      <VStack spacing={0} w="full">
        {sorted.map((task, i) => (
          <Flex
            key={task.id}
            w="full"
            py={2.5}
            align="center"
            justify="space-between"
            borderTop={i > 0 ? "1px solid" : "none"}
            borderColor="border"
            cursor="pointer"
            onClick={() => onTaskClick(task.id)}
            _hover={{ bg: "bg.hover" }}
            mx={-2}
            px={2}
            borderRadius="4px"
            transition="background 0.1s ease"
          >
            <HStack spacing={2.5} minW={0} flex={1}>
              <Icon
                as={task.completed ? FiCheckSquare : FiSquare}
                boxSize={3.5}
                color={task.completed ? "primary" : "text.tertiary"}
                cursor="pointer"
                flexShrink={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(task.id);
                }}
                _hover={{ color: "primary" }}
              />
              <Text
                fontSize="sm"
                color={task.completed ? "text.tertiary" : "text"}
                textDecoration={task.completed ? "line-through" : "none"}
                noOfLines={1}
              >
                {task.title}
              </Text>
            </HStack>
            {task.dueDate && (
              <Text fontSize="xs" color="text.tertiary" flexShrink={0} ml={2}>{formatDate(task.dueDate)}</Text>
            )}
          </Flex>
        ))}
      </VStack>
      <Text fontSize="xs" color="text.tertiary" mt={3}>
        {doneCount} of {totalCount} complete
      </Text>
    </WidgetShell>
  );
};

const NotesWidget = ({ notes, onCreateNote, dragControls }) => {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Notes" linkText="View All" linkTo="/notes" dragControls={dragControls}>
      <VStack spacing={2} w="full">
        {notes.map((note) => (
          <Box
            key={note.id}
            w="full"
            py={2}
            px={2}
            mx={-2}
            cursor="pointer"
            borderRadius="4px"
            _hover={{ bg: "bg.hover" }}
            transition="background 0.1s ease"
            onClick={() => navigate(`/notes?id=${note.id}`)}
          >
            <Text fontSize="sm" color="text" fontWeight="500" mb={0.5} noOfLines={1}>{note.title}</Text>
            <Text fontSize="xs" color="text.tertiary" noOfLines={1}>{note.preview}</Text>
          </Box>
        ))}
        <Box
          w="full"
          py={2}
          px={2}
          mx={-2}
          cursor="pointer"
          borderRadius="4px"
          _hover={{ bg: "bg.hover" }}
          transition="background 0.1s ease"
          onClick={onCreateNote}
        >
          <HStack spacing={2} color="text.tertiary">
            <Icon as={FiPlus} boxSize={3} />
            <Text fontSize="xs" fontWeight="400">New note</Text>
          </HStack>
        </Box>
      </VStack>
    </WidgetShell>
  );
};

const QuickAddWidget = ({ onCreateNote, dragControls }) => {
  const navigate = useNavigate();
  return (
    <WidgetShell title="Quick Add" dragControls={dragControls}>
      <VStack spacing={2} w="full">
        {[
          { label: "New Event", icon: FiPlus, to: "/calendar?new=1" },
          { label: "New Note", icon: FiEdit3, action: onCreateNote },
          { label: "New Task", icon: FiCheckSquare, to: "/todo" },
        ].map((item) => (
          <Button
            key={item.label}
            w="full"
            size="sm"
            variant="ghost"
            justifyContent="start"
            fontWeight="400"
            fontSize="sm"
            color="text.secondary"
            leftIcon={<Icon as={item.icon} boxSize={3.5} />}
            _hover={{ color: "text", bg: "bg.hover" }}
            px={2}
            h="36px"
            onClick={() => {
              if (item.action) {
                item.action();
              } else {
                navigate(item.to);
              }
            }}
          >
            {item.label}
          </Button>
        ))}
      </VStack>
    </WidgetShell>
  );
};

// --- Bookmarks Widget ---

const BookmarksWidget = ({ bookmarks: initialBookmarks, onBookmarksChange, dragControls }) => {
  const [bookmarks, setBookmarks] = useState(initialBookmarks);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [contextMenu, setContextMenu] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  useEffect(() => { setBookmarks(initialBookmarks); }, [initialBookmarks]);

  const persist = (updated) => {
    setBookmarks(updated);
    onBookmarksChange(updated);
  };

  const handleAdd = () => {
    const name = newName.trim();
    let url = newUrl.trim();
    if (!name || !url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const bookmark = { id: Date.now(), name, url, createdAt: new Date().toISOString() };
    persist([...bookmarks, bookmark]);
    setNewName("");
    setNewUrl("");
    setIsAdding(false);
  };

  const handleDelete = (id) => {
    persist(bookmarks.filter((b) => b.id !== id));
  };

  const handleEditSave = () => {
    const name = editName.trim();
    let url = editUrl.trim();
    if (!name || !url) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    persist(bookmarks.map((b) => b.id === editingId ? { ...b, name, url } : b));
    setEditingId(null);
  };

  const startEdit = (b) => {
    setEditingId(b.id);
    setEditName(b.name);
    setEditUrl(b.url);
  };

  const handleContextMenu = (e, bookmark) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item: bookmark });
  };

  // Close context menu on click/scroll/escape
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [contextMenu]);

  const getDomain = (url) => {
    try { return new URL(url).hostname; } catch { return ""; }
  };

  return (
    <WidgetShell title="Bookmarks" dragControls={dragControls}>
      <Flex gap={3} flexWrap="wrap" align="flex-start">
        {bookmarks.map((b) => (
          editingId === b.id ? (
            <VStack key={b.id} spacing={1.5} align="stretch" w="180px">
              <Input
                size="xs" placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)}
                borderRadius="4px" fontSize="xs" autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditingId(null); }}
              />
              <Input
                size="xs" placeholder="URL" value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                borderRadius="4px" fontSize="xs"
                onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditingId(null); }}
              />
              <HStack spacing={1}>
                <Button size="xs" bg="primary" color="white" _hover={{ bg: "#5a6656" }} borderRadius="4px" onClick={handleEditSave} isDisabled={!editName.trim() || !editUrl.trim()}>Save</Button>
                <Button size="xs" variant="ghost" color="text.tertiary" onClick={() => setEditingId(null)}>Cancel</Button>
              </HStack>
            </VStack>
          ) : (
            <Flex
              key={b.id}
              direction="column"
              align="center"
              position="relative"
              role="group"
              cursor="pointer"
              onClick={() => window.open(b.url, "_blank")}
              onContextMenu={(e) => handleContextMenu(e, b)}
              w="52px"
            >
              <Flex
                w="36px" h="36px" borderRadius="8px" bg="bg.surface" align="center" justify="center"
                border="1px solid" borderColor="border" mb={1} overflow="hidden" position="relative"
              >
                <Image
                  src={`https://www.google.com/s2/favicons?domain=${getDomain(b.url)}&sz=32`}
                  w="20px" h="20px"
                  fallback={
                    <Text fontSize="sm" fontWeight="600" color="text.secondary">
                      {b.name.charAt(0).toUpperCase()}
                    </Text>
                  }
                />
                <Flex
                  position="absolute" top="-4px" right="-4px" w="14px" h="14px" borderRadius="full"
                  bg="red.500" align="center" justify="center" opacity={0} _groupHover={{ opacity: 1 }}
                  transition="opacity 0.15s" cursor="pointer" zIndex={2}
                  onClick={(e) => { e.stopPropagation(); handleDelete(b.id); }}
                >
                  <Icon as={FiX} boxSize="8px" color="white" />
                </Flex>
              </Flex>
              <Text fontSize="10px" color="text.tertiary" noOfLines={1} textAlign="center" w="full">
                {b.name}
              </Text>
            </Flex>
          )
        ))}
        {isAdding ? (
          <VStack spacing={1.5} align="stretch" w="180px">
            <Input
              size="xs" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)}
              borderRadius="4px" fontSize="xs" autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setIsAdding(false); }}
            />
            <Input
              size="xs" placeholder="URL" value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
              borderRadius="4px" fontSize="xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setIsAdding(false); }}
            />
            <HStack spacing={1}>
              <Button size="xs" bg="primary" color="white" _hover={{ bg: "#5a6656" }} borderRadius="4px" onClick={handleAdd} isDisabled={!newName.trim() || !newUrl.trim()}>Add</Button>
              <Button size="xs" variant="ghost" color="text.tertiary" onClick={() => setIsAdding(false)}>Cancel</Button>
            </HStack>
          </VStack>
        ) : (
          <Flex
            direction="column" align="center" cursor="pointer" onClick={() => setIsAdding(true)} w="52px"
          >
            <Flex
              w="36px" h="36px" borderRadius="8px" align="center" justify="center"
              border="1.5px dashed" borderColor="border" mb={1}
              _hover={{ borderColor: "text.tertiary" }} transition="border-color 0.15s"
            >
              <Icon as={FiPlus} boxSize="14px" color="text.tertiary" />
            </Flex>
            <Text fontSize="10px" color="text.tertiary">Add</Text>
          </Flex>
        )}
      </Flex>

      {/* Context menu */}
      {contextMenu && (
        <Box
          position="fixed" left={`${contextMenu.x}px`} top={`${contextMenu.y}px`}
          zIndex={9999} bg="background" border="1px solid" borderColor="border"
          borderRadius="8px" shadow="0 8px 24px rgba(0,0,0,0.15)" py={1} minW="120px"
          onClick={(e) => e.stopPropagation()}
        >
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { window.open(contextMenu.item.url, "_blank"); setContextMenu(null); }}>
            <Text fontSize="xs" color="text">Open</Text>
          </Box>
          <Box h="1px" bg="border" mx={2} />
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { startEdit(contextMenu.item); setContextMenu(null); }}>
            <Text fontSize="xs" color="text">Edit</Text>
          </Box>
          <Box h="1px" bg="border" mx={2} />
          <Box px={3} py={2} cursor="pointer" _hover={{ bg: "bg.hover" }} transition="background 0.1s" onClick={() => { handleDelete(contextMenu.item.id); setContextMenu(null); }}>
            <Text fontSize="xs" color="red.400">Delete</Text>
          </Box>
        </Box>
      )}
    </WidgetShell>
  );
};

// --- Draggable Widget Wrapper ---

const DraggableWidget = ({ id, renderWidget, dragShadow }) => {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={id}
      value={id}
      as="div"
      dragListener={false}
      dragControls={dragControls}
      style={{ borderRadius: "8px" }}
      whileDrag={{
        scale: 1.02,
        boxShadow: dragShadow,
        zIndex: 10,
      }}
      transition={{ duration: 0.2 }}
    >
      <Box
        p={5}
        border="1px solid"
        borderColor="border"
        borderRadius="8px"
        bg="background"
        overflow="hidden"
        _hover={{ borderColor: "bg.active" }}
        transition="border-color 0.15s ease"
      >
        {renderWidget(dragControls)}
      </Box>
    </Reorder.Item>
  );
};

// --- Main Page ---

const HomePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // All data loaded from Firestore
  const [allTodos, setAllTodos] = useState([]);
  const [allNotes, setAllNotes] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_ORDER);
  const [userName, setUserName] = useState("");
  const initialLoadDone = useRef(false);

  // Load all data from Firestore on mount
  useEffect(() => {
    if (!user) return;
    Promise.all([
      dbLoadTodos(user.uid),
      dbLoadNotes(user.uid),
      dbLoadEvents(user.uid),
      dbLoadBookmarks(user.uid),
      dbLoadSettings(user.uid),
    ]).then(([todos, notes, events, bmarks, settings]) => {
      setAllTodos(todos);
      setAllNotes(notes);
      setAllEvents(events);
      setBookmarks(bmarks);
      if (settings.userName) setUserName(settings.userName);
      if (Array.isArray(settings.widgetOrder) && settings.widgetOrder.length > 0) {
        let order = settings.widgetOrder;
        if (!order.includes("bookmarks")) order = ["bookmarks", ...order];
        if (!order.includes("spotify")) order = [...order, "spotify"];
        setWidgetOrder(order);
      }
      initialLoadDone.current = true;

      // Schedule client-side notifications
      scheduleAllReminders(todos, events, {
        pushNotifications: settings.pushNotifications ?? true,
        reminderDays: settings.reminderDays ?? 3,
        reminderTime: settings.reminderTime ?? "09:00",
      });
    });

    return () => clearAllScheduledReminders();
  }, [user]);

  // Dashboard slices
  const tasks = useMemo(() => {
    const incomplete = allTodos.filter((t) => !t.completed).slice(0, 3);
    const completed = allTodos.filter((t) => t.completed).slice(0, 2);
    return [...incomplete, ...completed].map((t) => ({
      id: t.id, title: t.title || "Untitled", dueDate: t.dueDate || "", completed: !!t.completed,
    }));
  }, [allTodos]);

  const notes = useMemo(() => {
    return [...allNotes]
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, 3)
      .map((n) => {
        let preview = n.content || "";
        if (preview.includes("<")) {
          const tmp = document.createElement("div");
          tmp.innerHTML = preview;
          preview = tmp.textContent || tmp.innerText || "";
        }
        return { id: n.id, title: n.title || "Untitled", preview };
      });
  }, [allNotes]);

  const dragShadow = useColorModeValue(
    "0 8px 24px rgba(0,0,0,0.12)",
    "0 8px 24px rgba(0,0,0,0.4)"
  );

  const handleReorder = useCallback((newOrder) => {
    setWidgetOrder(newOrder);
    if (user) dbSaveSettings(user.uid, { widgetOrder: newOrder });
  }, [user]);

  const handleToggleTask = useCallback((id) => {
    setAllTodos((prev) => {
      const now = new Date().toISOString();
      const updated = prev.map((t) =>
        t.id === id ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : "", updatedAt: now } : t
      );
      if (user) dbSaveTodos(user.uid, updated);
      return updated;
    });
  }, [user]);

  const handleTaskClick = useCallback((id) => {
    navigate(`/todo?id=${id}`);
  }, [navigate]);

  const handleCreateNote = useCallback(() => {
    navigate("/notes?new=1");
  }, [navigate]);

  const handleBookmarksChange = useCallback((updated) => {
    setBookmarks(updated);
    if (user) dbSaveBookmarks(user.uid, updated);
  }, [user]);

  // PWA badge
  const pendingCount = useMemo(() => allTodos.filter((t) => !t.completed).length, [allTodos]);

  useEffect(() => {
    updateAppBadge(pendingCount);
  }, [pendingCount]);

  const totalEvents = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    return allEvents.filter((e) => e.date >= today && !e.isHoliday).length;
  }, [allEvents]);

  const stats = [
    { label: "Tasks", value: `${allTodos.length}` },
    { label: "Pending", value: `${allTodos.filter((t) => !t.completed).length}` },
    { label: "Done", value: `${allTodos.filter((t) => t.completed).length}` },
    { label: "Events", value: `${totalEvents}` },
  ];

  const getFirstName = () => {
    if (userName) return userName.split(" ")[0];
    if (user?.displayName) return user.displayName.split(" ")[0];
    return null;
  };

  // Widget registry — pass props to interactive widgets
  const WIDGETS = useMemo(() => ({
    bookmarks: (dc) => <BookmarksWidget bookmarks={bookmarks} onBookmarksChange={handleBookmarksChange} dragControls={dc} />,
    bills: (dc) => <EventsWidget allEvents={allEvents} dragControls={dc} />,
    tasks: (dc) => <TasksWidget tasks={tasks} onToggle={handleToggleTask} onTaskClick={handleTaskClick} totalCount={allTodos.length} doneCount={allTodos.filter((t) => t.completed).length} dragControls={dc} />,
    notes: (dc) => <NotesWidget notes={notes} onCreateNote={handleCreateNote} dragControls={dc} />,
    quickAdd: (dc) => <QuickAddWidget onCreateNote={handleCreateNote} dragControls={dc} />,
    spotify: (dc) => <WidgetShell title="Spotify" dragControls={dc}><SpotifyWidget /></WidgetShell>,
  }), [tasks, notes, allTodos, allEvents, bookmarks, handleToggleTask, handleTaskClick, handleCreateNote, handleBookmarksChange]);

  return (
    <Box px={{ base: 5, md: 10 }} py={{ base: 6, md: 8 }} minH="100vh">
      {/* Greeting */}
      <Box mb={10}>
        <Text
          fontSize={{ base: "lg", md: "xl" }}
          fontWeight="500"
          color="text"
          letterSpacing="-0.02em"
          mb={1}
        >
          {getGreeting(getFirstName())}
        </Text>
        <Text fontSize="xs" color="text.tertiary" letterSpacing="0.02em">
          {getFormattedDate()}
        </Text>
      </Box>

      {/* Stats */}
      <Flex
        mb={10}
        w="full"
        borderBottom="1px solid"
        borderColor="border"
        pb={6}
      >
        {stats.map((s) => (
          <Box key={s.label} flex={1} textAlign={{ base: "center", md: "left" }}>
            <Text
              fontSize="10px"
              fontWeight="500"
              color="text.tertiary"
              textTransform="uppercase"
              letterSpacing="0.1em"
              mb={1}
            >
              {s.label}
            </Text>
            <Text fontSize={{ base: "lg", md: "xl" }} fontWeight="600" color="text" letterSpacing="-0.02em">
              {s.value}
            </Text>
          </Box>
        ))}
      </Flex>

      {/* Widget Grid — Reorderable */}
      <Reorder.Group
        axis="y"
        values={widgetOrder}
        onReorder={handleReorder}
        as="div"
        className="widget-grid"
        style={{ listStyle: "none" }}
      >
        {widgetOrder.map((id) => {
          const renderWidget = WIDGETS[id];
          if (!renderWidget) return null;
          return (
            <DraggableWidget
              key={id}
              id={id}
              renderWidget={renderWidget}
              dragShadow={dragShadow}
            />
          );
        })}
      </Reorder.Group>
    </Box>
  );
};

export default HomePage;
