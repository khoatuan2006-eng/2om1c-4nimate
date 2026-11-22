param([int]$WorkerId, [string]$WorkerBirth)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class RenderJob {
 [StructLayout(LayoutKind.Sequential)] public struct Basic {
  public long ProcessTime, JobTime; public uint Flags; public UIntPtr Min, Max;
  public uint Active; public UIntPtr Affinity; public uint Priority, Scheduling;
 }
 [StructLayout(LayoutKind.Sequential)] public struct Counters { public ulong A,B,C,D,E,F; }
 [StructLayout(LayoutKind.Sequential)] public struct Extended {
  public Basic Basic; public Counters IO; public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob;
 }
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint size);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll", SetLastError=true)] static extern IntPtr OpenProcess(uint rights,bool inherit,int pid);
 [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetProcessTimes(IntPtr process,out long creation,out long exit,out long kernel,out long user);
 [DllImport("kernel32.dll", SetLastError=true)] static extern uint WaitForSingleObject(IntPtr handle,uint milliseconds);
 [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
 static void Check(bool success) { if(!success)throw new Win32Exception(Marshal.GetLastWin32Error()); }
 public static void Guard(int pid,string birth) {
  // The held process handle identifies a generation, even after PID reuse.
  IntPtr process=OpenProcess(0x00100000|0x0100|0x0001|0x0400,false,pid);
  if(process==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
  IntPtr job=IntPtr.Zero;
  try {
   long creation,exit,kernel,user;Check(GetProcessTimes(process,out creation,out exit,out kernel,out user));
   if("windows:"+DateTime.FromFileTimeUtc(creation).Ticks.ToString(System.Globalization.CultureInfo.InvariantCulture)!=birth)
    throw new InvalidOperationException("Worker generation changed before containment.");
   job=CreateJobObject(IntPtr.Zero,null);if(job==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());
   Extended info=new Extended();info.Basic.Flags=0x2000; // KILL_ON_JOB_CLOSE; no breakaway
   Check(SetInformationJobObject(job,9,ref info,(uint)Marshal.SizeOf(typeof(Extended))));
   Check(AssignProcessToJobObject(job,process));
   Console.WriteLine("contained");Console.Out.Flush();
   if(WaitForSingleObject(process,0xffffffff)!=0)throw new Win32Exception(Marshal.GetLastWin32Error());
  } finally {
   // This guardian was spawned before assignment and owns the only job handle.
   // Its death also closes the handle and terminates the contained process tree.
   if(job!=IntPtr.Zero)CloseHandle(job);CloseHandle(process);
  }
 }
}
'@
[RenderJob]::Guard($WorkerId,$WorkerBirth)
