"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { Folder, Plus, ChevronRight, Loader2 } from "lucide-react";
import type { ApiItemResponse, ApiListResponse, Project } from "@/types";

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const json = (await res.json()) as ApiListResponse<Project>;
      if (json.data) {
        setProjects(json.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setIsCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProjectName }),
      });
      const json = (await res.json()) as ApiItemResponse<Project>;
      if (json.data) {
        setProjects([json.data, ...projects]);
        setNewProjectName("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto w-full mt-8">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 uppercase tracking-widest">
            Projects Workspace
          </h1>
          <p className="text-neutral-500 text-xs mt-1">
            Select a project to manage API automations
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex gap-3 bg-neutral-900 p-4 border border-neutral-800 rounded-sm"
      >
        <input
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="ENTER PROJECT NAME..."
          className="flex-1 bg-neutral-950 border border-neutral-800 p-2 text-sm text-neutral-200 outline-none focus:border-cyan-500 transition-colors placeholder:text-neutral-700"
          disabled={isCreating}
        />
        <button
          type="submit"
          disabled={isCreating || !newProjectName.trim()}
          className="bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 px-4 py-2 text-sm font-semibold tracking-wider flex items-center gap-2 border border-neutral-700 transition-colors"
        >
          {isCreating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          CREATE
        </button>
      </form>

      {loading ? (
        <div className="text-center py-10 text-neutral-600 flex justify-center items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>LOADING...</span>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 border border-neutral-800 border-dashed text-neutral-600 bg-neutral-900/50">
          <Folder className="w-8 h-8 mx-auto mb-3 opacity-20" />
          <p className="tracking-widest">NO PROJECTS FOUND</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/project/${p.id}`}
              className="group flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 hover:border-cyan-500/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Folder className="w-5 h-5 text-neutral-500 group-hover:text-cyan-500 transition-colors" />
                <div>
                  <h2 className="font-semibold text-neutral-200">{p.name}</h2>
                  <p className="text-xs text-neutral-600 mt-1">ID: {p.id}</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-neutral-700 group-hover:text-cyan-500 transition-colors" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
