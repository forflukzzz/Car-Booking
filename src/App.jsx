import { useEffect, useState } from "react";
import "./App.css";
import Sidebar from "./Components/Sidebar";
import DataCar from "./Pages/Datacar/datacar";
import DataCarDetail from "./Pages/Datacar/datacarDetail";
import Bowrro from "./Pages/Bowrro/bowrro";
import ReturnPage from "./Pages/Bowrro/return";
import Profile from "./Pages/Profile/profile";
import History from "./Pages/History/history";
import Setting from "./Pages/Admin/Setting";
import Dashboard from "./Pages/Admin/Dashboard";
import ManageCar from "./Pages/Admin/managecar";
import HistoryManageCar from "./Pages/Admin/Historymanagecar";
import Login from "./Pages/Login/Login";
import { readBorrowRecords, updateBorrowRecord } from "./Database/borrowStorage";
import { createCar, deleteCar as deleteCarFromDatabase, readCars, updateCar as updateCarInDatabase, updateCarStatus, updateCarUsage } from "./Database/carStorage";
import { createCarServiceRecord, readCarServiceRecords } from "./Database/carServiceStorage";
import { approvePasswordReset, clearStoredDirectoryUser, createDirectoryUser, deleteDirectoryUser, getStoredDirectoryUser, readDirectoryUsers, readPasswordResetRequests, readSignedInDirectoryUser, saveSignedInUser, updateDirectoryUser } from "./Database/userDirectory";
import { supabase } from "./Database/supabase";

const pagePaths = {
  login: "/login",
  vehicles: "/datacar",
  "vehicle-detail": "/car/detail",
  "vehicle-request": "/car/request",
  status: "/history",
  "vehicle-return": "/history/return",
  profile: "/profile",
  settings: "/settings",
  managecar: "/managecar",
  historymanagecar: "/managecar/history",
  dashboard: "/dashboard",
};

const legacyPagePaths = { "/": "vehicles" };
const normalizePath = (pathname) => {
  const normalized = pathname.replace(/\/{2,}/g, "/").replace(/\/$/, "");
  return normalized || "/";
};
const getPageFromPath = (pathname) => {
  const path = normalizePath(pathname);
  return legacyPagePaths[path]
    ?? Object.entries(pagePaths).find(([, pagePath]) => pagePath === path)?.[0]
    ?? null;
};

const formatBookingDate = (date) => {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${String(Number(year) + 543).slice(-2)}`;
};

function App() {
  const [authReady, setAuthReady] = useState(false);
  const [session, setSession] = useState(null);
  // Restore the user saved at login so a browser refresh does not return to login.
  const [currentUser, setCurrentUser] = useState(() => getStoredDirectoryUser());
  const [profileResolvedId, setProfileResolvedId] = useState(null);
  const [borrowRecords, setBorrowRecords] = useState([]);
  const [users, setUsers] = useState([]);
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [cars, setCars] = useState([]);
  const [carServiceRecords, setCarServiceRecords] = useState([]);
  const [carLoadError, setCarLoadError] = useState("");
  const [storageError, setStorageError] = useState(null);
  const [activePage, setActivePage] = useState(
    () => getPageFromPath(window.location.pathname) ?? "vehicles",
  );
  const [selectedCar, setSelectedCar] = useState(null);
  const [selectedBorrowRecord, setSelectedBorrowRecord] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session && getStoredDirectoryUser()?.role === "admin") setCurrentUser(null);
    }).finally(() => setAuthReady(true));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession && getStoredDirectoryUser()?.role === "admin") {
        setCurrentUser(null);
        setProfileResolvedId(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    readSignedInDirectoryUser(session.user.id)
      .then(async (profile) => {
        if (!active) return;
        if (!profile) {
          await supabase.auth.signOut();
          return;
        }
        setCurrentUser(profile);
      })
      .catch(async () => {
        if (active) {
          setCurrentUser(null);
          await supabase.auth.signOut();
        }
      })
      .finally(() => { if (active) setProfileResolvedId(session.user.id); });
    return () => { active = false; };
  }, [session?.user?.id]);

  useEffect(() => {
    const refreshBorrowRecords = () => {
      readBorrowRecords().then(setBorrowRecords).catch((error) => setStorageError(error instanceof Error ? error.message : "โหลดประวัติการใช้รถไม่สำเร็จ"));
    };
    refreshBorrowRecords();
    const interval = window.setInterval(refreshBorrowRecords, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!borrowRecords.length || !cars.length) return;
    const latestByCar = new Map();
    borrowRecords.forEach((record) => {
      if (record.carId != null && !latestByCar.has(record.carId)) latestByCar.set(record.carId, record.status);
    });
    const activeByCar = new Map([...latestByCar].filter(([, status]) => status === "reserved" || status === "in-use"));
    if (!activeByCar.size) return;
    setCars((currentCars) => currentCars.map((car) => {
      const recordStatus = activeByCar.get(car.id);
      if (!recordStatus) return car;
      return { ...car, status: recordStatus === "reserved" ? "reserved" : "busy", requestDisabled: true };
    }));
  }, [borrowRecords, cars.length]);

  useEffect(() => {
    if (!currentUser || !["admin", "manager"].includes(currentUser.role)) return;
    readDirectoryUsers().then(setUsers).catch(() => setUsers([]));
    if (currentUser.role === "admin") readPasswordResetRequests().then(setPasswordResetRequests).catch(() => setPasswordResetRequests([]));
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    readCars()
      .then((savedCars) => { setCars(savedCars); setCarLoadError(""); })
      .catch((error) => {
        const detail = error && typeof error === "object" && "message" in error
          ? String(error.message)
          : String(error || "ไม่ทราบสาเหตุ");
        setCarLoadError(`โหลดข้อมูลรถไม่สำเร็จ: ${detail}`);
      });
  }, []);

  useEffect(() => {
    readCarServiceRecords().then(setCarServiceRecords).catch(() => setCarServiceRecords([]));
  }, []);

  useEffect(() => {
    const syncPageWithUrl = () => {
      const page = getPageFromPath(window.location.pathname);
      if (page) {
        setActivePage(page);
        if (window.location.pathname !== pagePaths[page]) {
          window.history.replaceState(null, "", pagePaths[page]);
        }
      } else {
        window.history.replaceState(null, "", pagePaths.vehicles);
        setActivePage("vehicles");
      }
    };

    window.addEventListener("popstate", syncPageWithUrl);
    const initialPage = getPageFromPath(window.location.pathname);
    if (!initialPage) {
      window.history.replaceState(null, "", pagePaths.vehicles);
      setActivePage("vehicles");
    } else if (window.location.pathname !== pagePaths[initialPage]) {
      window.history.replaceState(null, "", pagePaths[initialPage]);
    }
    return () => window.removeEventListener("popstate", syncPageWithUrl);
  }, []);

  const navigateToPage = (page) => {
    if (!Object.hasOwn(pagePaths, page)) return;
    setActivePage(page);
    if (window.location.pathname !== pagePaths[page]) {
      window.history.pushState(null, "", pagePaths[page]);
    }
  };

  useEffect(() => {
    if (currentUser && normalizePath(window.location.pathname) === pagePaths.login) {
      navigateToPage("vehicles");
    }
  }, [currentUser]);

  useEffect(() => {
    if (authReady && !session && !currentUser && normalizePath(window.location.pathname) !== pagePaths.login) {
      setActivePage("login");
      window.history.replaceState(null, "", pagePaths.login);
    }
  }, [authReady, currentUser, session]);

  const pageTitles = {
    vehicles: "ข้อมูลรถยนต์",
    status: "บันทึกการใช้รถ",
    profile: "โปรไฟล์",
  };

  const openCarDetail = (car) => {
    setSelectedCar(car);
    navigateToPage("vehicle-detail");
  };

  const openCarRequest = (car) => {
    setSelectedCar(car);
    navigateToPage("vehicle-request");
  };

  const openReturn = (record) => {
    const matchingCar = cars.find((car) => car.id === record.carId || car.plate === record.plate);
    setSelectedBorrowRecord({ ...record, image: matchingCar?.image });
    navigateToPage("vehicle-return");
  };

  const completeReturn = async (details) => {
    try {
      const returnedRecord = borrowRecords.find((record) => record.id === details.id);
      const returnedCar = returnedRecord
        ? cars.find((car) => car.id === returnedRecord.carId || car.plate === returnedRecord.plate)
        : null;
      if (!returnedCar) throw new Error("ไม่พบรถที่ตรงกับรายการคืนรถ");

      const updated = await updateBorrowRecord(details.id, { date: formatBookingDate(details.startDate), requester: details.requester, purpose: details.purpose, endMileage: details.mileage, returnDate: details.returnDate, distance: details.distance, status: "returned" });
      if (details.issueReport?.trim()) {
        const { error: issueError } = await supabase.from("vehicle_issue_reports").insert({
          borrow_record_id: details.id,
          car_id: returnedCar.id,
          plate: returnedRecord.plate,
          model: returnedRecord.model,
          requester: details.requester,
          issue_description: details.issueReport.trim(),
        });
        if (issueError) throw issueError;
      }
      const savedCar = await updateCarUsage(returnedCar.id, details.mileage, details.returnDate);
      setBorrowRecords((records) => records.map((record) => record.id === updated.id ? { ...updated, issueReport: details.issueReport?.trim() || undefined } : record));
      setCars((currentCars) => currentCars.map((car) => car.id === savedCar.id ? savedCar : car));
      setSelectedCar((currentCar) => currentCar?.id === savedCar.id ? savedCar : currentCar);
      setStorageError(null);
      navigateToPage("status");
      return true;
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "บันทึกการคืนรถไม่สำเร็จ");
      throw error;
    }
  };

  const cancelReservation = async (id) => {
    try {
      const reservation = borrowRecords.find((record) => record.id === id);
      const reservedCar = reservation ? cars.find((car) => car.id === reservation.carId || car.plate === reservation.plate) : null;
      const embeddedUid = reservation?.requester.match(/\(UID:\s*([^)]+)\)\s*$/i)?.[1];
      const reservationUid = reservation?.requesterUid || embeddedUid;
      if (!reservation || !currentUser?.uid || reservationUid !== currentUser.uid) {
        throw new Error("\u0e40\u0e09\u0e1e\u0e32\u0e30\u0e1c\u0e39\u0e49\u0e08\u0e2d\u0e07\u0e40\u0e17\u0e48\u0e32\u0e19\u0e31\u0e49\u0e19\u0e08\u0e36\u0e07\u0e22\u0e01\u0e40\u0e25\u0e34\u0e01\u0e44\u0e14\u0e49");
      }
      if (!reservation || !reservedCar) throw new Error("ไม่พบรถที่ตรงกับรายการจองนี้");
      const updated = await updateBorrowRecord(id, { status: "cancelled" });
      const savedCar = await updateCarStatus(reservedCar.id, "available");
      setBorrowRecords((records) => records.map((record) => record.id === id ? updated : record));
      setCars((currentCars) => currentCars.map((car) => car.id === savedCar.id ? savedCar : car));
      setSelectedCar((currentCar) => currentCar?.id === savedCar.id ? savedCar : currentCar);
      setStorageError(null);
    } catch (error) { setStorageError(error instanceof Error ? error.message : "ยกเลิกการจองไม่สำเร็จ"); }
  };

  const addDirectoryUser = async (user) => {
    const createdUser = await createDirectoryUser(user);
    setUsers((currentUsers) => [...currentUsers, createdUser]);
  };

  const addCar = async (car, imageFile) => {
    const createdCar = await createCar(car, imageFile);
    setCars((currentCars) => [...currentCars, createdCar]);
    setCarLoadError("");
  };

  const updateCar = async (id, changes, imageFile) => {
    const savedCar = await updateCarInDatabase(id, changes, imageFile);
    setCars((currentCars) => currentCars.map((car) => car.id === id ? savedCar : car));
    setSelectedCar((currentCar) => currentCar?.id === id ? savedCar : currentCar);
    setCarLoadError("");
  };

  const addCarServiceRecord = async (record) => {
    const savedRecord = await createCarServiceRecord(record);
    setCarServiceRecords((currentRecords) => [savedRecord, ...currentRecords]);
    const currentCar = cars.find((car) => car.id === record.carId);
    const carChanges = currentCar && {
      ...currentCar,
      mileage: record.mileage || currentCar.mileage,
      ...(record.recordType === "prb" ? { prbExpiry: record.expiryDate } : {}),
      ...(record.recordType === "insurance" ? { insuranceExpiry: record.expiryDate } : {}),
      ...(record.recordType === "maintenance" ? { maintenanceDue: record.serviceDate } : {}),
      ...(record.recordType === "maintenance" && record.nextMaintenanceMileage
        ? { nextMaintenanceMileage: record.nextMaintenanceMileage }
        : {}),
      ...(["maintenance", "service-center"].includes(record.recordType)
        ? { lastServiceDate: record.serviceDate }
        : {}),
      ...(record.recordType === "service-center" ? { serviceCenter: record.serviceCenter } : {}),
    };
    const savedCar = carChanges
      ? await updateCarInDatabase(currentCar.id, carChanges)
      : null;
    if (savedCar) {
      setCars((currentCars) => currentCars.map((car) => car.id === savedCar.id ? savedCar : car));
      setSelectedCar((selected) => selected?.id === savedCar.id ? savedCar : selected);
    }
  };

  const deleteCar = async (id) => {
    await deleteCarFromDatabase(id);
    setCars((currentCars) => currentCars.filter((car) => car.id !== id));
    setCarLoadError("");
    if (selectedCar?.id === id) {
      setSelectedCar(null);
      navigateToPage("vehicles");
    }
  };

  const changeDirectoryUserRole = async (id, role) => {
    const updatedUser = await updateDirectoryUser(id, { role });
    setUsers((currentUsers) => currentUsers.map((user) => user.id === id ? updatedUser : user));
  };

  const editDirectoryUser = async (id, changes) => {
    const updatedUser = await updateDirectoryUser(id, changes);
    setUsers((currentUsers) => currentUsers.map((user) => user.id === id ? updatedUser : user));
  };

  const approveDirectoryPasswordReset = async (requestId, temporaryPassword) => {
    await approvePasswordReset(requestId, temporaryPassword);
    setPasswordResetRequests((requests) => requests.map((request) => request.id === requestId ? { ...request, status: "approved", temporaryPassword } : request));
  };

  const removeDirectoryUser = async (id) => {
    await deleteDirectoryUser(id);
    setUsers((currentUsers) => currentUsers.filter((user) => user.id !== id));
  };

  const handleSignedIn = (user) => {
    saveSignedInUser(user);
    setCurrentUser(user);
    setActivePage("vehicles");
    window.history.replaceState(null, "", pagePaths.vehicles);
    if (user.role !== "admin") setAuthReady(true);
  };

  const handleLogout = async () => {
    clearStoredDirectoryUser();
    setCurrentUser(null);
    setSelectedCar(null);
    setSelectedBorrowRecord(null);
    setActivePage("login");
    window.history.replaceState(null, "", pagePaths.login);
    if (session) await supabase.auth.signOut();
  };

  const saveCarRequest = async (carId) => {
    const updatedRecords = await readBorrowRecords();
    setBorrowRecords(updatedRecords);
    const latestRecord = updatedRecords.find((record) => record.carId === carId && (record.status === "reserved" || record.status === "in-use"));
    setCars((currentCars) => currentCars.map((item) => item.id === carId
      ? { ...item, status: latestRecord?.status === "reserved" ? "reserved" : "busy", requestDisabled: true }
      : item));
    setStorageError(null);
    navigateToPage("status");
  };

  const renderPage = () => {
    const canManage = currentUser && ["admin", "manager"].includes(currentUser.role);
    if (activePage === "settings" && currentUser?.role !== "admin") {
      return <DataCar cars={cars} records={borrowRecords} serviceRecords={carServiceRecords} carLoadError={carLoadError} onViewDetails={openCarDetail} onRequest={openCarRequest} userUid={currentUser?.uid} onReturn={openReturn} onCancelReservation={cancelReservation} />;
    }
    if ((activePage === "dashboard" || activePage === "managecar" || activePage === "historymanagecar") && !canManage) {
      return <DataCar cars={cars} records={borrowRecords} serviceRecords={carServiceRecords} carLoadError={carLoadError} onViewDetails={openCarDetail} onRequest={openCarRequest} userUid={currentUser?.uid} onReturn={openReturn} onCancelReservation={cancelReservation} />;
    }
    switch (activePage) {
      case "login":
      case "vehicles":
        return (
          <DataCar
            cars={cars}
            records={borrowRecords}
            serviceRecords={carServiceRecords}
            carLoadError={carLoadError}
            onViewDetails={openCarDetail}
            onRequest={openCarRequest}
            userUid={currentUser?.uid}
            onReturn={openReturn}
            onCancelReservation={cancelReservation}
          />
        );
      case "vehicle-detail":
        return selectedCar ? (
          <DataCarDetail
            car={selectedCar}
            records={borrowRecords}
            serviceRecords={carServiceRecords}
            onBack={() => navigateToPage("vehicles")}
          />
        ) : (
          <DataCar
            cars={cars}
            records={borrowRecords}
            serviceRecords={carServiceRecords}
            carLoadError={carLoadError}
            onViewDetails={openCarDetail}
            onRequest={openCarRequest}
            userUid={currentUser?.uid}
            onReturn={openReturn}
            onCancelReservation={cancelReservation}
          />
        );
      case "vehicle-request":
        return selectedCar ? (
          <Bowrro
            car={selectedCar}
            requesterName={currentUser?.name}
            requesterUid={currentUser?.uid}
            onCancel={() => navigateToPage("vehicles")}
            onSaved={saveCarRequest}
          />
        ) : (
          <DataCar
            cars={cars}
            records={borrowRecords}
            serviceRecords={carServiceRecords}
            carLoadError={carLoadError}
            onViewDetails={openCarDetail}
            onRequest={openCarRequest}
            userUid={currentUser?.uid}
            onReturn={openReturn}
            onCancelReservation={cancelReservation}
          />
        );
      case "status":
        return (
          <History
            onNewRequest={() => navigateToPage("vehicles")}
            onReturn={openReturn}
            onCancelReservation={cancelReservation}
            records={borrowRecords}
            storageError={storageError}
            userUid={currentUser?.uid}
          />
        );
      case "vehicle-return":
        return selectedBorrowRecord ? (
          <ReturnPage
            record={selectedBorrowRecord}
            onCancel={() => navigateToPage("status")}
            onConfirm={completeReturn}
          />
        ) : (
          <History
            onNewRequest={() => navigateToPage("vehicles")}
            onReturn={openReturn}
            onCancelReservation={cancelReservation}
            records={borrowRecords}
            storageError={storageError}
            userUid={currentUser?.uid}
          />
        );
      case "profile":
        return <Profile user={currentUser ?? { name: "Guest", uid: "guest" }} records={borrowRecords} onReturn={openReturn} onCancelReservation={cancelReservation} onRefresh={async () => { const latestRecords = await readBorrowRecords(); setBorrowRecords(latestRecords); }} />;
      case "settings":
        return <Setting users={users} cars={cars} carLoadError={carLoadError} passwordResetRequests={passwordResetRequests} onApprovePasswordReset={approveDirectoryPasswordReset} onAddCar={addCar} onUpdateCar={updateCar} onDeleteCar={deleteCar} onAddUser={addDirectoryUser} onUpdateUser={editDirectoryUser} onDeleteUser={removeDirectoryUser} />;
      case "managecar":
        return <ManageCar cars={cars} borrowRecords={borrowRecords} serviceRecords={carServiceRecords} carLoadError={carLoadError} performedBy={currentUser?.name ?? ""} onAddServiceRecord={addCarServiceRecord} />;
      case "historymanagecar":
        return <HistoryManageCar cars={cars} serviceRecords={carServiceRecords} borrowRecords={borrowRecords} carLoadError={carLoadError} />;
      case "dashboard":
        return <Dashboard cars={cars} historyRecords={borrowRecords} serviceRecords={carServiceRecords} />;
      default:
        return <h1>{pageTitles[activePage]}</h1>;
    }
  };

  if (!authReady || (session && profileResolvedId !== session.user.id)) return <main className="auth-loading">กำลังตรวจสอบบัญชี…</main>;
  if ((!session && !currentUser) || currentUser?.mustChangePassword) return <Login onSignedIn={handleSignedIn} />;
  const displayUser = currentUser;

  return (
    <div className="app-layout">
      <Sidebar
        activeItem={
          activePage === "status" || activePage === "vehicle-return"
            ? "status"
            : activePage === "profile"
              ? "profile"
              : activePage === "settings"
                ? "settings"
                : activePage === "managecar"
                  ? "managecar"
                : activePage === "historymanagecar"
                  ? "historymanagecar"
                : activePage === "dashboard"
                  ? "dashboard"
              : "vehicles"
        }
        onNavigate={navigateToPage}
        role={displayUser.role}
        onLogout={handleLogout}
      />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
