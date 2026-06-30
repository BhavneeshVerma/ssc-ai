import random
import os
import json
import tkinter as tk
from tkinter import ttk, messagebox
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg

# File where your data will be saved permanently
STATS_FILE = "trainer_persistent_stats.json"

class AdvancedAlphabetTrainer:
    def __init__(self, root):
        self.root = root
        self.root.title("AlphaNumerics Pro Trainer")
        self.root.geometry("900x600")
        self.root.configure(bg="#0f172a") # Deep Slate Blue
        
        # --- Core Variables ---
        self.modes = [
            "Alphabet ➔ Number (e.g., G = 7)",
            "Number ➔ Alphabet (e.g., 14 = N)",
            "Alphabet ➔ Opposite (e.g., D = W)",
            "Multiplication Tables (1-50)"
        ]
        self.selected_mode = tk.StringVar(value=self.modes[0])
        self.current_question = None
        self.current_answer = None
        self.timer_seconds_left = 0
        self.timer_running = False
        
        # Session Stats
        self.session_correct = 0
        self.session_total = 0
        
        # Load permanent data from file
        self.load_persistent_stats()

        # --- UI Styling Setup ---
        self.style = ttk.Style()
        self.style.theme_use("clam")
        self.style.configure("TLabel", background="#0f172a", foreground="#f8fafc", font=("Segoe UI", 11))
        self.style.configure("Header.TLabel", font=("Segoe UI", 20, "bold"), foreground="#38bdf8")
        self.style.configure("Card.TLabel", font=("Segoe UI", 48, "bold"), foreground="#f8fafc", background="#1e293b")
        self.style.configure("Sub.TLabel", font=("Segoe UI", 11), foreground="#94a3b8")
        
        self.style.configure("TButton", font=("Segoe UI", 11, "bold"), background="#38bdf8", foreground="#0f172a", borderwidth=0)
        self.style.map("TButton", background=[("active", "#7dd3fc")])
        self.style.configure("Action.TButton", font=("Segoe UI", 10, "bold"), background="#334155", foreground="#f8fafc")
        self.style.map("Action.TButton", background=[("active", "#475569")])

        # Style the Notebook tabs to match the dark theme
        self.style.configure("TNotebook", background="#0f172a", borderwidth=0)
        self.style.configure("TNotebook.Tab", background="#1e293b", foreground="#94a3b8", padding=[15, 5], font=("Segoe UI", 10, "bold"))
        self.style.map("TNotebook.Tab", background=[("selected", "#0f172a")], foreground=[("selected", "#38bdf8")])

        # --- Layout Windows ---
        self.setup_layout()
        self.reset_session()
        self.update_weak_areas_display()
        self.draw_performance_graph()

    def load_persistent_stats(self):
        """Loads historical progress from a local JSON text file."""
        if os.path.exists(STATS_FILE):
            try:
                with open(STATS_FILE, "r") as f:
                    data = json.load(f)
                    self.all_time_correct = data.get("all_time_correct", 0)
                    self.all_time_total = data.get("all_time_total", 0)
                    self.wrong_counts = data.get("wrong_counts", {})
                    # Ensure all letters exist in wrong tracking
                    for char in "ABCDEFGHIJKLMNOPQRSTUVWXYZ":
                        if char not in self.wrong_counts:
                            self.wrong_counts[char] = 0
                    self.table_wrong_counts = data.get("table_wrong_counts", {})
                    for t in range(1, 51):
                        t_str = f"Table {t}"
                        if t_str not in self.table_wrong_counts:
                            self.table_wrong_counts[t_str] = 0
            except:
                self.reset_factory_stats()
        else:
            self.reset_factory_stats()

    def reset_factory_stats(self):
        self.all_time_correct = 0
        self.all_time_total = 0
        self.wrong_counts = {chr(i): 0 for i in range(65, 91)}
        self.table_wrong_counts = {f"Table {t}": 0 for t in range(1, 51)}
        self.save_persistent_stats()

    def save_persistent_stats(self):
        """Saves historical progress to a local JSON text file permanently."""
        data = {
            "all_time_correct": self.all_time_correct,
            "all_time_total": self.all_time_total,
            "wrong_counts": self.wrong_counts,
            "table_wrong_counts": self.table_wrong_counts
        }
        try:
            with open(STATS_FILE, "w") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            print(f"Error saving stats: {e}")

    def setup_layout(self):
        # Master Notebook Tabs
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill="both", expand=True)
        
        # Create Tab Frames
        self.tab_train = tk.Frame(self.notebook, bg="#0f172a")
        self.tab_stats = tk.Frame(self.notebook, bg="#0f172a")
        
        self.notebook.add(self.tab_train, text="  🎯 Training Arena  ")
        self.notebook.add(self.tab_stats, text="  📊 Analytics & Weak Spots  ")
        
        # --- TAB 1: TRAINING ARENA INTERNAL DESIGN ---
        left_panel = tk.Frame(self.tab_train, bg="#0f172a", width=500)
        left_panel.pack(side="left", fill="both", expand=True, padx=20, pady=10)
        
        # Header title
        title = ttk.Label(left_panel, text="AlphaNumerics Speed Pad", style="Header.TLabel")
        title.pack(pady=(10, 2))
        
        # Persistent Score Tracker Row
        self.per_score_lbl = ttk.Label(left_panel, text="ALL-TIME ACCURACY: 0%", font=("Segoe UI", 10, "bold"), foreground="#10b981")
        self.per_score_lbl.pack(pady=(0, 15))
        self.update_persistent_scoreboard_text()

        # Settings Box
        settings_frame = tk.LabelFrame(left_panel, text=" Configuration Panel ", bg="#0f172a", fg="#94a3b8", font=("Segoe UI", 10, "bold"), padx=15, pady=10)
        settings_frame.pack(fill="x", pady=5)
        
        ttk.Label(settings_frame, text="Select Mode:", style="Sub.TLabel").grid(row=0, column=0, sticky="w", pady=5)
        self.mode_menu = ttk.Combobox(settings_frame, textvariable=self.selected_mode, values=self.modes, state="readonly", width=32, font=("Segoe UI", 10))
        self.mode_menu.grid(row=0, column=1, padx=10, pady=5)
        self.mode_menu.bind("<<ComboboxSelected>>", lambda e: self.reset_session())
        
        ttk.Label(settings_frame, text="Set Session Timer:", style="Sub.TLabel").grid(row=1, column=0, sticky="w", pady=5)
        self.timer_menu = ttk.Combobox(settings_frame, values=["1 Minute", "2 Minutes", "3 Minutes", "5 Minutes"], state="readonly", width=12, font=("Segoe UI", 10))
        self.timer_menu.grid(row=1, column=1, sticky="w", padx=10, pady=5)
        self.timer_menu.current(0)
        
        # Start Workout Button
        self.start_btn = ttk.Button(settings_frame, text="START RUN", command=self.start_timer_session)
        self.start_btn.grid(row=2, column=0, columnspan=2, sticky="ew", pady=(10, 0))

        # Big Question Engine Card
        self.inst_lbl = ttk.Label(left_panel, text="Click 'START RUN' to launch the countdown timer!", font=("Segoe UI", 11, "italic"), foreground="#94a3b8")
        self.inst_lbl.pack(pady=(20, 5))
        
        self.card = tk.Frame(left_panel, bg="#1e293b", bd=1, relief="solid")
        self.card.pack(fill="x", pady=5)
        self.q_lbl = ttk.Label(self.card, text="--", style="Card.TLabel", anchor="center")
        self.q_lbl.pack(pady=20, fill="x")

        # Live Timer / Session Score Row
        status_row = tk.Frame(left_panel, bg="#0f172a")
        status_row.pack(fill="x", pady=5)
        self.live_timer_lbl = ttk.Label(status_row, text="⏱ TIME LEFT: --", font=("Segoe UI", 12, "bold"), foreground="#ef4444")
        self.live_timer_lbl.pack(side="left")
        self.live_score_lbl = ttk.Label(status_row, text="RUN SCORE: 0 / 0", font=("Segoe UI", 12, "bold"), foreground="#38bdf8")
        self.live_score_lbl.pack(side="right")

        # Typing entry
        self.entry = tk.Entry(
            left_panel,
            font=("Segoe UI", 22, "bold"),
            justify="center",
            bg="#0f172a",
            fg="#38bdf8",
            insertbackground="#38bdf8",
            disabledbackground="#1e293b",
            disabledforeground="#475569",
            highlightbackground="#334155",
            highlightcolor="#38bdf8",
            highlightthickness=2,
            bd=0,
            state="disabled"
        )
        self.entry.pack(pady=10, fill="x")
        self.entry.bind("<Return>", lambda e: self.evaluate_user_answer())

        # Submits / Skips
        btn_row = tk.Frame(left_panel, bg="#0f172a")
        btn_row.pack(fill="x", pady=5)
        self.sub_btn = ttk.Button(btn_row, text="SUBMIT (Enter)", state="disabled", command=self.evaluate_user_answer)
        self.sub_btn.pack(side="left", expand=True, fill="x", padx=(0, 10))
        self.sk_btn = ttk.Button(btn_row, text="SKIP", style="Action.TButton", state="disabled", command=self.skip_question)
        self.sk_btn.pack(side="right", expand=True, fill="x")
        
        self.feed_lbl = ttk.Label(left_panel, text="", font=("Segoe UI", 12, "bold"))
        self.feed_lbl.pack(pady=10)

        # --- TAB 2: ANALYTICS & WEAK SPOTS INTERNAL DESIGN ---
        # Left sidebar text list for top critical mistakes
        self.weak_sidebar = tk.LabelFrame(self.tab_stats, text=" ⚠️ High Error Target Zones ", bg="#0f172a", fg="#ef4444", font=("Segoe UI", 11, "bold"), padx=15, pady=15, width=280)
        self.weak_sidebar.pack(side="left", fill="both", expand=False, padx=20, pady=20)
        
        self.weak_text_box = tk.Text(self.weak_sidebar, bg="#1e293b", fg="#f8fafc", font=("Consolas", 11), wrap="word", bd=0, highlightthickness=0, width=25)
        self.weak_text_box.pack(fill="both", expand=True)
        self.weak_text_box.config(state="disabled")
        
        reset_all_btn = ttk.Button(self.weak_sidebar, text="RESET ALL PERMANENT DATA", style="Action.TButton", command=self.wipe_history_data)
        reset_all_btn.pack(fill="x", pady=(10, 0))

        # Right side Graph panel hosting the matplotlib bar plot
        self.graph_frame = tk.LabelFrame(self.tab_stats, text=" Mistake Distribution Bar Chart ", bg="#0f172a", fg="#38bdf8", font=("Segoe UI", 11, "bold"), padx=10, pady=10)
        self.graph_frame.pack(side="right", fill="both", expand=True, padx=(0, 20), pady=20)
        
        # Connect visual changes across notebook views
        self.notebook.bind("<<NotebookTabChanged>>", lambda e: self.refresh_analytics_view())

    def update_persistent_scoreboard_text(self):
        if self.all_time_total > 0:
            percentage = int((self.all_time_correct / self.all_time_total) * 100)
            self.per_score_lbl.config(text=f"ALL-TIME HISTORICAL ACCURACY: {percentage}% ({self.all_time_correct}/{self.all_time_total} total answers correct)")
        else:
            self.per_score_lbl.config(text="ALL-TIME HISTORICAL ACCURACY: No historical runs recorded yet.")

    def reset_session(self):
        self.session_correct = 0
        self.session_total = 0

    def start_timer_session(self):
        """Starts a new countdown training session."""
        if self.timer_running:
            self.end_timer_session()
            return

        # Parse timer duration
        duration_str = self.timer_menu.get()
        try:
            minutes = int(duration_str.split()[0])
            self.timer_seconds_left = minutes * 60
        except Exception:
            self.timer_seconds_left = 60 # Default fallback
            
        self.reset_session()
        self.live_score_lbl.config(text="RUN SCORE: 0 / 0")
        self.feed_lbl.config(text="")
        
        self.timer_running = True
        self.start_btn.config(text="STOP RUN")
        self.mode_menu.config(state="disabled")
        self.timer_menu.config(state="disabled")
        
        self.entry.config(state="normal")
        self.entry.delete(0, tk.END)
        self.entry.focus_set()
        
        self.sub_btn.config(state="normal")
        self.sk_btn.config(state="normal")
        
        self.trigger_next_prompt()
        self.tick_timer()

    def tick_timer(self):
        """Timer countdown loop."""
        if not self.timer_running:
            return
            
        if self.timer_seconds_left >= 0:
            mins, secs = divmod(self.timer_seconds_left, 60)
            self.live_timer_lbl.config(text=f"⏱ TIME LEFT: {mins:02d}:{secs:02d}")
            self.timer_seconds_left -= 1
            self.root.after(1000, self.tick_timer)
        else:
            self.end_timer_session()

    def end_timer_session(self):
        """Wraps up the active session and saves stats."""
        self.timer_running = False
        self.start_btn.config(text="START RUN")
        self.mode_menu.config(state="readonly")
        self.timer_menu.config(state="readonly")
        
        self.entry.config(state="disabled")
        self.sub_btn.config(state="disabled")
        self.sk_btn.config(state="disabled")
        
        self.live_timer_lbl.config(text="⏱ TIME LEFT: --")
        
        accuracy = 0
        if self.session_total > 0:
            accuracy = int((self.session_correct / self.session_total) * 100)
            
        # Display completion summary
        messagebox.showinfo(
            "Run Completed!",
            f"Great job!\n\n"
            f"Correct Answers: {self.session_correct}\n"
            f"Total Attempts: {self.session_total}\n"
            f"Session Accuracy: {accuracy}%"
        )
        
        # Save historical progress permanently
        self.save_persistent_stats()
        self.update_persistent_scoreboard_text()
        self.refresh_analytics_view()

    def trigger_next_prompt(self):
        """Generates the next question, biasing toward letters/tables with high mistake counts."""
        mode = self.selected_mode.get()
        
        if mode == self.modes[3]:  # Multiplication Tables (1-50)
            tables = [f"Table {t}" for t in range(1, 51)]
            weights = []
            for t_str in tables:
                wrong_count = self.table_wrong_counts.get(t_str, 0)
                weights.append(1 + 3 * wrong_count)
            chosen_table_str = random.choices(tables, weights=weights, k=1)[0]
            self.current_table = chosen_table_str
            table_num = int(chosen_table_str.split()[1])
            multiplier = random.randint(1, 10)
            
            self.current_question = f"{table_num} × {multiplier}"
            self.current_answer = str(table_num * multiplier)
            self.inst_lbl.config(text="Solve the multiplication problem:")
        else:
            # We will bias question generation based on letter error counts.
            letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
            weights = []
            for char in letters:
                wrong_count = self.wrong_counts.get(char, 0)
                # Bias factor: Add weight to characters with mistakes
                weights.append(1 + 3 * wrong_count)
                
            # Random pick based on weights
            chosen_letter = random.choices(letters, weights=weights, k=1)[0]
            self.current_letter = chosen_letter
            
            # Map modes to question/answer structures
            if mode == self.modes[0]:  # Alphabet ➔ Number (A=1)
                self.current_question = chosen_letter
                self.current_answer = str(ord(chosen_letter) - 64)
                self.inst_lbl.config(text="What is the numeric position of the letter?")
            elif mode == self.modes[1]:  # Number ➔ Alphabet (14=N)
                num = ord(chosen_letter) - 64
                self.current_question = str(num)
                self.current_answer = chosen_letter
                self.inst_lbl.config(text="What letter is at this numeric position?")
            else:  # Alphabet ➔ Opposite (A=Z, B=Y)
                self.current_question = chosen_letter
                opposite = chr(90 - (ord(chosen_letter) - 65))
                self.current_answer = opposite
                self.inst_lbl.config(text="What is the opposite letter?")
            
        self.q_lbl.config(text=self.current_question)
        self.entry.delete(0, tk.END)

    def evaluate_user_answer(self):
        """Checks the user's answer and updates scoreboard and feed feedback."""
        if not self.timer_running:
            return
            
        user_input = self.entry.get().strip().upper()
        if not user_input:
            return
            
        self.session_total += 1
        self.all_time_total += 1
        
        correct_answer = self.current_answer.upper()
        mode = self.selected_mode.get()
        
        if user_input == correct_answer:
            self.session_correct += 1
            self.all_time_correct += 1
            self.feed_lbl.config(text=f"✓ Correct! ({self.current_question} ➔ {self.current_answer})", foreground="#10b981")
        else:
            if mode == self.modes[3]:
                table_str = getattr(self, "current_table", None)
                if table_str and table_str in self.table_wrong_counts:
                    self.table_wrong_counts[table_str] += 1
            else:
                char = getattr(self, "current_letter", None)
                if char and char in self.wrong_counts:
                    self.wrong_counts[char] += 1
            self.feed_lbl.config(text=f"✗ Incorrect. Correct answer was: {self.current_answer}", foreground="#ef4444")
            
        self.live_score_lbl.config(text=f"RUN SCORE: {self.session_correct} / {self.session_total}")
        
        # Save after every answer to avoid loss
        self.save_persistent_stats()
        self.update_persistent_scoreboard_text()
        
        # Prompt next question
        self.trigger_next_prompt()

    def skip_question(self):
        """Skips the current question, marking it as incorrect to train weak areas."""
        if not self.timer_running:
            return
            
        self.session_total += 1
        self.all_time_total += 1
        
        mode = self.selected_mode.get()
        if mode == self.modes[3]:
            table_str = getattr(self, "current_table", None)
            if table_str and table_str in self.table_wrong_counts:
                self.table_wrong_counts[table_str] += 1
        else:
            char = getattr(self, "current_letter", None)
            if char and char in self.wrong_counts:
                self.wrong_counts[char] += 1
            
        self.feed_lbl.config(text=f"Skipped! Correct answer was: {self.current_answer}", foreground="#f59e0b")
        self.live_score_lbl.config(text=f"RUN SCORE: {self.session_correct} / {self.session_total}")
        
        self.save_persistent_stats()
        self.update_persistent_scoreboard_text()
        self.trigger_next_prompt()

    def update_weak_areas_display(self):
        """Displays top critical mistakes in the sidebar text widget."""
        sorted_letter_wrongs = sorted(
            [(char, count) for char, count in self.wrong_counts.items() if count > 0],
            key=lambda x: x[1],
            reverse=True
        )
        sorted_table_wrongs = sorted(
            [(t_str, count) for t_str, count in self.table_wrong_counts.items() if count > 0],
            key=lambda x: x[1],
            reverse=True
        )
        
        self.weak_text_box.config(state="normal")
        self.weak_text_box.delete("1.0", tk.END)
        
        if not sorted_letter_wrongs and not sorted_table_wrongs:
            self.weak_text_box.insert(tk.END, "🎉 No mistakes recorded yet!\nKeep up the perfect runs!")
        else:
            if sorted_letter_wrongs:
                self.weak_text_box.insert(tk.END, "Top Alphabet Errors:\n")
                self.weak_text_box.insert(tk.END, f"{'Letter':<12}{'Mistakes':<10}\n")
                self.weak_text_box.insert(tk.END, "-" * 22 + "\n")
                for char, count in sorted_letter_wrongs[:5]:
                    self.weak_text_box.insert(tk.END, f"  {char:<13}{count:<10}\n")
                self.weak_text_box.insert(tk.END, "\n")
                
            if sorted_table_wrongs:
                self.weak_text_box.insert(tk.END, "Top Table Errors:\n")
                self.weak_text_box.insert(tk.END, f"{'Table':<12}{'Mistakes':<10}\n")
                self.weak_text_box.insert(tk.END, "-" * 22 + "\n")
                for t_str, count in sorted_table_wrongs[:5]:
                    self.weak_text_box.insert(tk.END, f"  {t_str:<13}{count:<10}\n")
                
        self.weak_text_box.config(state="disabled")

    def draw_performance_graph(self):
        """Plots the mistake count in a matplotlib chart based on current mode."""
        for widget in self.graph_frame.winfo_children():
            widget.destroy()
            
        mode = self.selected_mode.get()
        
        fig, ax = plt.subplots(figsize=(6, 4.2), dpi=100)
        fig.patch.set_facecolor("#0f172a")
        ax.set_facecolor("#1e293b")
        
        if mode == self.modes[3]: # Multiplication Tables
            tables = [f"T{t}" for t in range(1, 51)]
            counts = [self.table_wrong_counts.get(f"Table {t}", 0) for t in range(1, 51)]
            total_mistakes = sum(counts)
            
            if total_mistakes == 0:
                ax.text(0.5, 0.5, "No table mistakes recorded yet.\nStart a training run!", 
                        color="#94a3b8", fontsize=12, ha="center", va="center", transform=ax.transAxes)
                ax.set_xticks([])
                ax.set_yticks([])
                for spine in ax.spines.values():
                    spine.set_visible(False)
            else:
                # Filter to only show tables with mistakes
                filtered_tables = []
                filtered_counts = []
                for t in range(1, 51):
                    c = self.table_wrong_counts.get(f"Table {t}", 0)
                    if c > 0:
                        filtered_tables.append(f"T{t}")
                        filtered_counts.append(c)
                
                bars = ax.bar(filtered_tables, filtered_counts, color="#f43f5e", edgecolor="#be123c", width=0.6)
                ax.set_title("Mistake Frequency by Table", fontsize=12, color="#38bdf8", fontweight="bold", pad=15)
                ax.tick_params(colors="#94a3b8", labelsize=8)
                ax.set_xlabel("Table", color="#94a3b8", fontsize=10, labelpad=8)
                ax.set_ylabel("Error Count", color="#94a3b8", fontsize=10, labelpad=8)
                ax.grid(True, axis="y", linestyle="--", alpha=0.1, color="#f8fafc")
                
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                ax.spines['left'].set_color("#334155")
                ax.spines['bottom'].set_color("#334155")
                
                max_count = max(filtered_counts)
                ax.set_ylim(0, max_count + 1)
        else: # Alphabet modes
            letters = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
            counts = [self.wrong_counts.get(char, 0) for char in letters]
            total_mistakes = sum(counts)
            
            if total_mistakes == 0:
                ax.text(0.5, 0.5, "No mistakes recorded yet.\nStart a training run!", 
                        color="#94a3b8", fontsize=12, ha="center", va="center", transform=ax.transAxes)
                ax.set_xticks([])
                ax.set_yticks([])
                for spine in ax.spines.values():
                    spine.set_visible(False)
            else:
                bars = ax.bar(letters, counts, color="#f43f5e", edgecolor="#be123c", width=0.6)
                ax.set_title("Mistake Frequency by Letter", fontsize=12, color="#38bdf8", fontweight="bold", pad=15)
                ax.tick_params(colors="#94a3b8", labelsize=8)
                ax.set_xlabel("Letter", color="#94a3b8", fontsize=10, labelpad=8)
                ax.set_ylabel("Error Count", color="#94a3b8", fontsize=10, labelpad=8)
                ax.grid(True, axis="y", linestyle="--", alpha=0.1, color="#f8fafc")
                
                ax.spines['top'].set_visible(False)
                ax.spines['right'].set_visible(False)
                ax.spines['left'].set_color("#334155")
                ax.spines['bottom'].set_color("#334155")
                
                max_count = max(counts)
                ax.set_ylim(0, max_count + 1)
                
        fig.tight_layout()
        
        canvas = FigureCanvasTkAgg(fig, master=self.graph_frame)
        canvas.draw()
        canvas.get_tk_widget().pack(fill="both", expand=True)
        plt.close(fig)

    def refresh_analytics_view(self):
        """Updates analytics display when tab is focused."""
        self.update_weak_areas_display()
        self.draw_performance_graph()

    def wipe_history_data(self):
        """Prompts to reset all permanent stats history."""
        confirm = messagebox.askyesno(
            "Confirm Reset",
            "Are you sure you want to permanently delete all history and training stats?\nThis cannot be undone."
        )
        if confirm:
            self.reset_factory_stats()
            self.update_persistent_scoreboard_text()
            self.refresh_analytics_view()
            messagebox.showinfo("Reset Successful", "All training stats have been cleared.")

if __name__ == "__main__":
    root = tk.Tk()
    app = AdvancedAlphabetTrainer(root)
    root.mainloop()

